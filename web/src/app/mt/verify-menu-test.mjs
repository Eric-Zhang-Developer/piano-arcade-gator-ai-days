// Headless proof of menu-test (spec: menu-test, Validation): /mt shows one card per chart under public/songs, the
// centred one flat; screenshots at 1440 and 375 px with no horizontal scroll; three Right presses centre the fourth
// song and its caption; a drag past the last song wraps to the first; Enter opens /play?song=<id>; and after a
// recorded Twinkle take, /mt's caption shows its best rank.
// Usage: node web/src/app/mt/verify-menu-test.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-menu-test.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

// The charts on disk, by folder id, to check the page against.
const songsDir = join(webDir, "public/songs");
const charts = Object.fromEntries(
  readdirSync(songsDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.split(sep).pop() === "chart.json")
    .map((f) => [dirname(f).split(sep).join("/"), JSON.parse(readFileSync(join(songsDir, f), "utf8"))]),
);

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-menu-test: starting next dev on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
  cwd: webDir,
  detached: true,
  stdio: ["ignore", "ignore", "inherit"],
});
process.on("exit", () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

const settle = (page) => page.waitForTimeout(700); // the 450 ms ease-out, with room
const centred = (page) => page.locator("[aria-current]").getAttribute("data-song");
const caption = async (page) => (await page.getByTestId("mt-caption").textContent()).replace(/\s+/g, " ").trim();
const bestCell = async (page) => (await page.getByTestId("mt-best").locator("dd").textContent()).trim();

const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${base}/mt`)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fail = [];

  // 1. One card per chart, the centred one flat and the rest tilted. Screenshots at 1440 and 375, no side scroll.
  await page.goto(`${base}/mt`);
  await page.locator("[aria-current]").waitFor({ timeout: 60_000 });
  await settle(page);
  const ids = await page.locator("[data-song]").evaluateAll((els) => els.map((e) => e.getAttribute("data-song")));
  const poses = await page.locator("[data-song]").evaluateAll((els) => els.map((e) => ({ t: e.style.transform, current: e.hasAttribute("aria-current") })));
  const flat = poses.filter((p) => /rotateY\(-?0deg\)/.test(p.t));
  say(`verify-menu-test: ${ids.length} cards for ${Object.keys(charts).length} charts; flat: ${flat.length} (centred ${flat[0]?.current})`);
  if (ids.length !== Object.keys(charts).length || ids.some((id) => !charts[id])) fail.push(`1: cards ${ids.join(",")}`);
  if (flat.length !== 1 || !flat[0].current) fail.push("1: not exactly the centred card flat");
  for (const [w, h] of [[1440, 900], [375, 812]]) {
    await page.setViewportSize({ width: w, height: h });
    await settle(page);
    const sideScroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await page.screenshot({ path: join(out, `mt-${w}.png`) });
    say(`verify-menu-test: ${w} px -> horizontal overflow ${sideScroll} px`);
    if (sideScroll > 0) fail.push(`1: ${sideScroll} px of horizontal scroll at ${w} px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // 2. Right three times: the fourth song is centred, with its title, composer, notes and level.
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await settle(page);
  const fourth = await centred(page);
  const c4 = charts[fourth];
  const text4 = await caption(page);
  say(`verify-menu-test: Right x3 -> ${fourth}: "${text4}"`);
  if (fourth !== ids[3]) fail.push(`2: centred ${fourth}, expected ${ids[3]}`);
  for (const want of [c4.title, c4.composer, `Notes${c4.notes.length}`]) if (!text4.includes(want)) fail.push(`2: caption lacks "${want}"`);
  if (!/Level\d+/.test(text4)) fail.push("2: caption has no level");
  await page.screenshot({ path: join(out, "mt-fourth.png") });

  // 3. Step to the last song, then drag left one card: the first song comes round, the far side stays invisible.
  for (let i = 3; i < ids.length - 1; i++) await page.keyboard.press("ArrowRight");
  await settle(page);
  const last = await centred(page);
  const box = await page.locator("[aria-current]").boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // The wrap must not pop: between drag steps of a tenth of a card, no card's opacity may jump.
  const opacities = () => page.locator("[data-song]").evaluateAll((els) => els.map((e) => (e.style.visibility === "hidden" ? 0 : Number(e.style.opacity))));
  let prev = await opacities();
  let worst = 0;
  for (let s = 1; s <= 12; s++) {
    await page.mouse.move(box.x + box.width / 2 - (s * box.width * 1.1) / 12, y);
    await page.waitForTimeout(40); // a frame to paint
    const now = await opacities();
    worst = Math.max(worst, ...now.map((o, i) => Math.abs(o - prev[i])));
    prev = now;
    if (s === 6) await page.screenshot({ path: join(out, "mt-wrap-drag.png") });
  }
  await page.waitForTimeout(150); // held still before letting go: a placed drag, not a flick
  await page.mouse.up();
  await settle(page);
  const wrapped = await centred(page);
  say(`verify-menu-test: last ${last}, drag left -> ${wrapped}; largest opacity step while dragging ${worst.toFixed(2)}`);
  if (worst > 0.25) fail.push(`3: a card's opacity jumped ${worst.toFixed(2)} in one drag step`);
  if (last !== ids.at(-1) || wrapped !== ids[0]) fail.push(`3: drag from ${last} landed on ${wrapped}, expected ${ids[0]}`);

  // 4. Enter on the centred card opens /play?song=<that id>.
  await page.keyboard.press("ArrowRight");
  await settle(page);
  const picked = await centred(page);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/play\?song=/, { timeout: 60_000 });
  const playUrl = new URL(page.url());
  say(`verify-menu-test: Enter on ${picked} -> ${playUrl.pathname}${playUrl.search}`);
  if (playUrl.searchParams.get("song") !== picked) fail.push(`4: opened ${playUrl.search}, expected song=${picked}`);

  // 5. A recorded Twinkle take (the test input hook), then /mt: Twinkle's caption shows its best rank.
  await page.goto(`${base}/play?song=twinkle&input=test&beat=off&stage=off`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate((notes) => notes.forEach(([pitch, t]) => window.__pianoArcade.press(pitch, t)), chart.notes.map((n) => [n.pitch, n.beat * mpb]));
  await page.getByTestId("records").waitFor({ timeout: 120_000 });
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem("pianoArcade.records") ?? "{}").twinkle?.best);
  await page.goto(`${base}/mt`);
  await page.locator("[aria-current]").waitFor({ timeout: 60_000 });
  const ti = ids.indexOf("twinkle");
  for (let i = 0; i < ti; i++) await page.keyboard.press("ArrowRight");
  await settle(page);
  const bestText = await bestCell(page);
  say(`verify-menu-test: after a take (best ${best?.rank} ${best?.accuracy}) -> /mt ${await centred(page)} "${bestText}"`);
  if (!best || !bestText.includes(best.rank) || !bestText.includes(`${(best.accuracy * 100).toFixed(1)}%`)) fail.push(`5: best caption "${bestText}"`);
  const others = ids.length > 1 ? ids[(ti + 1) % ids.length] : null;
  if (others) {
    await page.keyboard.press("ArrowRight");
    await settle(page);
    const none = await bestCell(page);
    if (none !== "") fail.push(`5: an unplayed song shows "${none}"`);
  }
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  await page.screenshot({ path: join(out, "mt-best.png") });

  fail.push(...errors);
  writeFileSync(join(out, "menu-test.json"), JSON.stringify({ ids, fourth, last, wrapped, picked, best, bestText, worst }, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-menu-test: pass (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-menu-test: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
