// Headless proof of attract mode, the spec's Chrome steps that don't need the piano: (1) Space plays, pillars rise,
// counters climb, a chapter captions, with the laptop tone (the rhythm is timed in step 6); (3) clicking a done
// pillar opens its spec, PR and done note; (4) a timeline bar's tooltip; (5) ?snapshot with every non-local request
// blocked still plays; (6) with WebGL disabled the flat list shows and still plays. Step 2 is Eric's, on the piano.
// A snapshot.json that was already there is put back afterwards.
// Usage: node web/src/replay/verify-replay.mjs --out <dir>
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-replay.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snapFile = join(webDir, "public/operator/snapshot.json");
const before = existsSync(snapFile) ? readFileSync(snapFile) : null;
const chart = JSON.parse(readFileSync(join(webDir, "public/songs/twinkle/chart.json"), "utf8"));

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
  cwd: webDir,
  detached: true,
  stdio: ["ignore", "ignore", "inherit"],
});
let failed = false;
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failed = true;
};
function cleanup() {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
  if (before) writeFileSync(snapFile, before);
  else rmSync(snapFile, { force: true });
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

// The step number beside the scrubber (a span; the FEATURES DONE counter is a dd with the same "n / m" shape).
const stepOf = (page) =>
  page.evaluate(() => Number([...document.querySelectorAll("span")].find((x) => /^\d+ \/ \d+$/.test(x.textContent))?.textContent.split(" / ")[0]));
const counter = async (page, name) => Number((await page.locator(`dt:text-is("${name}") + dd`).innerText()).split(" / ")[0]);

let browser;
try {
  for (let end = Date.now() + 120_000; ; await sleep(500)) {
    if (await fetch(`${base}/attract`).then((r) => r.ok, () => false)) break;
    if (server.exitCode !== null) throw new Error("next dev exited (is another dev server running in web/?)");
    if (Date.now() > end) throw new Error("dev server not up after 120 s");
  }
  browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Space plays: the laptop tone, counters, a raised pillar, a chapter.
  await page.goto(`${base}/attract`);
  await page.getByText("● LIVE").waitFor({ timeout: 60_000 });
  await page.locator("canvas").waitFor({ timeout: 30_000 });
  await page.keyboard.press("Space");
  await sleep(9_000);
  check(await page.getByText(/laptop tone/).isVisible(), "no piano attached: the laptop tone plays");
  const [merged, step] = await page.evaluate(() => [
    Number([...document.querySelectorAll("dt")].find((d) => d.textContent === "PRS MERGED").nextElementSibling.textContent),
    Number([...document.querySelectorAll("span")].find((x) => /^\d+ \/ \d+$/.test(x.textContent)).textContent.split(" / ")[0]),
  ]);
  check(merged === step && merged >= 10, `PRS MERGED climbs with the steps (${merged} at step ${step})`);
  check((await counter(page, "FEATURES DONE")) >= 1, "FEATURES DONE climbed: a pillar rose");
  check(await page.getByText(/^(The first PR|Milestone built|Peak)/).first().isVisible(), "a chapter is captioned");
  await page.screenshot({ path: join(out, "attract-mid-replay.png") });
  await page.keyboard.press("Space"); // pause
  const paused = await stepOf(page);
  await sleep(1500);
  check((await stepOf(page)) === paused, "Space pauses");

  // 3. A done pillar opens its spec, PR and done note.
  const pos = await page.evaluate(() => window.__attract.screenOf("core-loop"));
  await page.mouse.click(pos.x, pos.y);
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 5_000 }).catch(() => {});
  const links = await dialog.locator("a").evaluateAll((as) => as.map((a) => a.href)).catch(() => []);
  check(
    links.some((h) => h.endsWith("/specs/features/core-loop/spec.md")) && links.some((h) => /\/pull\/\d+$/.test(h)) && links.some((h) => h.endsWith("/changes/core-loop.md")),
    `clicking the core-loop pillar offers its spec, PR and done note (${links.length} links)`,
  );

  // 4. A timeline bar's tooltip.
  const bar = page.locator("svg rect").nth(5);
  await bar.scrollIntoViewIfNeeded();
  await bar.hover();
  const tip = await page.getByRole("tooltip").innerText({ timeout: 3_000 }).catch(() => "");
  check(/^#\d+ .* · .* · opened /.test(tip), `hovering a timeline bar shows its tooltip ("${tip.slice(0, 60)}…")`);
  await page.screenshot({ path: join(out, "attract-timeline.png"), fullPage: true });
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

  // 5. The snapshot, with nothing but localhost reachable.
  const frozen = await fetch(`${base}/api/operator/snapshot`, { method: "POST" });
  check(frozen.ok, "froze a snapshot through operator-board's route");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(["midi"]); // a fresh context would otherwise leave the MIDI request pending
  const asked = [];
  await ctx.route("**/*", (route) => {
    asked.push(route.request().url());
    return new URL(route.request().url()).hostname === "localhost" ? route.continue() : route.abort("internetdisconnected");
  });
  const snap = await ctx.newPage();
  await snap.goto(`${base}/attract?snapshot`);
  await snap.getByText("❄ SNAPSHOT").waitFor({ timeout: 30_000 });
  await snap.keyboard.press("Space");
  await sleep(4_000);
  check((await stepOf(snap)) >= 4, `?snapshot plays offline (step ${await stepOf(snap)})`);
  check(!asked.some((u) => u.includes("/api/") || new URL(u).hostname !== "localhost"), `?snapshot made no /api or outside call (${asked.length} requests)`);
  await ctx.close();

  // 6. No WebGL: the flat list, still stepping.
  const flat = await chromium.launch({ headless: true, args: ["--disable-webgl", "--disable-3d-apis"] });
  const fctx = await flat.newContext({ viewport: { width: 1280, height: 900 } });
  await fctx.grantPermissions(["midi"]);
  const fp = await fctx.newPage();
  await fp.goto(`${base}/attract?snapshot`);
  await fp.getByText(/No WebGL here/).waitFor({ timeout: 30_000 });
  check((await fp.locator("canvas").count()) === 0, "without WebGL: no canvas, the flat list instead");
  // The rhythm is timed here: headless WebGL is software-rendered, and its 200-500 ms frames on a loaded machine
  // stall every timer on the page, which says nothing about the clock. Step times come from inside the page.
  await fp.evaluate(() => {
    const el = [...document.querySelectorAll("span")].find((x) => /^\d+ \/ \d+$/.test(x.textContent));
    window.__steps = [];
    new MutationObserver(() => window.__steps.push({ k: Number(el.textContent.split(" / ")[0]), t: performance.now() })).observe(el, {
      childList: true, characterData: true, subtree: true,
    });
  });
  await fp.keyboard.press("Space");
  await sleep(9_000);
  const seen = await fp.evaluate(() => window.__steps);
  const gaps = seen.slice(2).map((s, i) => ({ got: s.t - seen[i + 1].t, k: s.k }));
  const beat = 60_000 / chart.bpm;
  const off = gaps.map(({ got, k }) => Math.abs(got - (chart.notes[k - 1].beat - chart.notes[k - 2].beat) * beat));
  check(gaps.length >= 8 && Math.max(...off) < 120, `steps land on Twinkle's beats (${gaps.length} gaps, worst ${Math.round(Math.max(...off))} ms off)`);
  check((await stepOf(fp)) >= 4 && (await fp.getByText(/^▲ /).count()) >= 1, `without WebGL the replay still steps and raises (step ${await stepOf(fp)})`);
  await fp.screenshot({ path: join(out, "attract-no-webgl.png") });
  await flat.close();
} catch (e) {
  check(false, String(e?.stack ?? e));
} finally {
  await browser?.close();
}
say(failed ? "verify-replay: FAIL" : `verify-replay: pass (screenshots in ${out})`);
process.exit(failed ? 1 : 0);
