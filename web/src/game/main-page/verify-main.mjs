// Headless proof of main-page (spec: main-page, Validation 2). Starts its own dev server.
// 1. / shows section headers in Level order, and the first row is focused.
// 2. A click on the last chip shows that section's first song, focused.
// 3. ↓ from a section's last song focuses the next section's first song.
// 4. Composer: the chips are surnames; "chopin" leaves only the Chopin section.
// 5. At 1280×720 and 1920×1080 the page doesn't scroll, and the list's text is at least 16 and 24 px.
// Screenshots at both sizes.
// Usage: node web/src/game/main-page/verify-main.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-main.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-main: starting next dev on ${port}`);
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

const browser = await chromium.launch({ headless: true });
const fail = [];
const check = (ok, what) => {
  say(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) fail.push(what);
};
try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(`${base}/`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  context.on("weberror", (e) => errors.push(e.error().message));
  const page = await context.newPage();
  const chips = page.locator('nav[aria-label="Jump to a section"] button');
  const headers = () => page.$$eval('ol[aria-label="Songs"] h3', (hs) => hs.map((h) => h.id));
  const active = () => page.evaluate(() => document.activeElement?.dataset?.testid ?? "");
  // A section's songs, by the header's id.
  const songsOf = (id) => page.$$eval(`#${id} + ol a`, (as) => as.map((a) => a.dataset.testid));

  // 1. Level sections, the first row focused.
  await page.goto(`${base}/`);
  await chips.first().waitFor({ timeout: 60_000 });
  await page.evaluate(() => ["pianoArcade.songSort", "pianoArcade.lastPlayed"].forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await chips.first().waitFor({ timeout: 60_000 });
  const level = await headers();
  check(level.length >= 2 && level.every((id) => id.startsWith("section-lv-")), `Level sections: ${level.join(", ")}`);
  const order = level.map((id) => Number(id.replace("section-lv-", "")));
  check(order.every((n, i) => i === 0 || order[i - 1] < n), "the sections run up the levels");
  const first = (await songsOf(level[0]))[0];
  await page.waitForFunction((id) => document.activeElement?.dataset?.testid === id, first, { timeout: 10_000 }).catch(() => {});
  check((await active()) === first, `the first row is focused (${await active()})`);
  const total = await page.locator('ol[aria-label="Songs"] a').count();
  check((await page.getByTestId("list-place").textContent())?.replace(/\s/g, "") === `1/${total}`, `the place reads 1 / ${total}`);

  // 2. The last chip.
  const lastId = level[level.length - 1];
  await chips.last().click();
  const lastFirst = (await songsOf(lastId))[0];
  check((await active()) === lastFirst, `the last chip focuses its section's first song (${await active()})`);
  check(await page.getByTestId(lastFirst).isVisible() && (await page.getByTestId(lastFirst).boundingBox()).y < 720, "and it's in view");
  await page.screenshot({ path: join(out, "last-chip-1280.png") });

  // 3. ↓ across a header.
  const sec0 = await songsOf(level[0]);
  await page.getByTestId(sec0[sec0.length - 1]).focus();
  await page.keyboard.press("ArrowDown");
  const next = (await songsOf(level[1]))[0];
  check((await active()) === next, `↓ from ${sec0[sec0.length - 1]} lands on ${next} (${await active()})`);

  // 4. Composer, then "chopin".
  await page.getByTestId("finder-sort-composer").click();
  const labels = await chips.allTextContents();
  check(labels.length > level.length && labels.includes("Chopin") && labels.every((l) => !/^LV/.test(l)), `Composer's chips are surnames (${labels.join(", ")})`);
  await page.screenshot({ path: join(out, "composer-1280.png") });
  await page.getByTestId("finder-search").fill("chopin");
  check((await headers()).join() === "section-by-chopin" && (await chips.allTextContents()).join() === "Chopin", "chopin leaves only the Chopin section");
  await page.getByTestId("finder-search").fill("");
  await page.getByTestId("finder-sort-level").click();

  // 5. Both sizes: no page scroll, and the list's own text at the floor.
  for (const [w, h, floor] of [
    [1280, 720, 16],
    [1920, 1080, 24],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const list = document.querySelector('ol[aria-label="Songs"]');
      const els = [...document.querySelectorAll('nav[aria-label="Jump to a section"] button, [data-testid=list-place], ol[aria-label=Songs] h3 *, ol[aria-label=Songs] a *')];
      const sizes = els.filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => parseFloat(getComputedStyle(e).fontSize));
      const box = list.getBoundingClientRect();
      const rows = [...list.querySelectorAll("a")].filter((a) => {
        const r = a.getBoundingClientRect();
        return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      }).length;
      return { scrolls: document.documentElement.scrollHeight > innerHeight, smallest: Math.min(...sizes), rows };
    });
    check(!m.scrolls, `${w}×${h}: the page doesn't scroll`);
    check(m.smallest >= floor - 0.5, `${w}×${h}: the list's smallest text is ${m.smallest} px (floor ${floor})`);
    say(`     ${w}×${h}: ${m.rows} rows wholly in view`);
    await page.screenshot({ path: join(out, `level-${w}.png`) });
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
if (fail.length) {
  say("verify-main: FAIL");
  for (const f of fail) say(`  ${f}`);
  process.exit(1);
}
say(`verify-main: pass (evidence: ${out})`);
process.exit(0);
