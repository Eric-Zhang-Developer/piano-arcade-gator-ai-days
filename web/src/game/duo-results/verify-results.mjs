// Headless proof of the Duo results (spec: duo-results, Validation 2): Für Elise played to the end through the test
// hook, every note pressed at its time except two in three of bars 9–12, the left hand 30 ms late. Then the six data
// cells read the take's own numbers, BY BAR has one cell per bar and brackets bars 9–12, the first view needs no scroll
// at 1280×720 or 1920×1080, and PRACTICE BARS 9–12 opens bar-loop on those bars at 70%.
// Usage: node web/src/game/duo-results/verify-results.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-results.mjs --out <dir>");
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
say(`verify-results: starting next dev on ${port}`);
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

const failures = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};
const sizes = [
  [1280, 720],
  [1920, 1080],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// A prior Für Elise best no take can beat (a fixture, not a real score), so the planted take isn't a NEW RECORD. A
// record take features record-moment alone and moves BY BAR to Details (results-layout), which isn't what this checks.
await page.addInitScript(() => {
  if (localStorage.getItem("pianoArcade.records")) return;
  const fixture = { initials: "FIX", score: 1_000_000, accuracy: 1, rank: "S", maxCombo: 294, date: "2026-01-01T00:00:00.000Z" };
  localStorage.setItem("pianoArcade.records", JSON.stringify({ "fur-elise": { best: { rank: "S", accuracy: 1, score: 1_000_000, date: fixture.date }, top: [fixture] } }));
});
for (let i = 0; ; i++) {
  try {
    await page.goto(`${base}/play?song=fur-elise&input=test&stage=off&idle=3600`); // idle: demo-reset waits an hour
    break;
  } catch (e) {
    if (i > 60) throw e;
    await page.waitForTimeout(1000); // the dev server is still starting
  }
}
await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 120_000 });
// A planted take: a weak run at bars 9–12 the tutor must find, and a dragging left hand for TIMING.
await page.evaluate(() => {
  const { chart, press } = window.__pianoArcade;
  const mpb = 60000 / chart.bpm;
  chart.notes.forEach((n, k) => {
    const bar = Math.floor(n.beat / chart.beatsPerBar) + 1;
    if (bar >= 9 && bar <= 12 && k % 3) return;
    press(n.pitch, n.beat * mpb + (n.hand === "L" ? 30 : 0));
  });
});
await page.getByTestId("results").waitFor({ timeout: 400_000 });
await page.waitForTimeout(2500); // the tally and the rank stamp
check((await page.getByTestId("record-moment").count()) === 0, "the take isn't a NEW RECORD (the fixture best holds)");
const { r, bars } = await page.evaluate(() => {
  const { results: r, chart } = window.__pianoArcade;
  return { r, bars: Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar) };
});

// 1. The six cells are the take's numbers, and the strip has a cell per bar (or per 2 past 64 bars).
const text = async (id) => (await page.getByTestId(id).textContent({ timeout: 5000 }).catch(() => null))?.trim();
const want = {
  "count-PERFECT": String(r.counts.PERFECT),
  "count-GREAT": String(r.counts.GREAT),
  "count-GOOD": String(r.counts.GOOD ?? 0),
  "count-MISS": String(r.counts.MISS),
  accuracy: `${(r.accuracy * 100).toFixed(1)}%`,
  "max-combo": String(r.maxCombo),
};
for (const [id, v] of Object.entries(want)) check((await text(id)) === v, `${id} reads ${v} (${await text(id)})`);
const per = Math.ceil(bars / 64);
const cells = await page.getByTestId("duo-bar").count();
check(cells === Math.ceil(bars / per), `BY BAR has ${Math.ceil(bars / per)} cells for ${bars} bars (${cells})`);
const bins = await page.getByTestId("duo-bin").evaluateAll((els) => els.reduce((s, e) => s + Number(e.dataset.count), 0));
const timed = r.judgments.filter((j) => j.offsetMs !== null).length;
check(bins === timed, `TIMING's bins hold every timed note (${bins} of ${timed})`);

// 3. The first view: no scroll, the tutor's button and Retry inside the window, at both sizes; then reduced motion.
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  const view = await page.evaluate(() => {
    const scroller = document.querySelector('[data-testid="results"]').parentElement;
    const inView = (id) => {
      const el = document.querySelector(`[data-testid="${id}"]`) ?? [...document.querySelectorAll("button")].find((b) => b.textContent === id);
      const b = el?.getBoundingClientRect();
      return !!b && b.top >= 0 && b.bottom <= innerHeight;
    };
    return { top: scroller.scrollTop + scrollY, practice: inView("duo-practice"), retry: inView("Retry"), run: inView("duo-run") };
  });
  check(view.top === 0 && view.practice && view.retry && view.run, `${w}×${h}: no scroll, and the bracket, PRACTICE and Retry are in the first view (${JSON.stringify(view)})`);
  await page.screenshot({ path: join(out, `results-${w}x${h}.png`) });
}
await page.setViewportSize({ width: 1280, height: 720 });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.waitForTimeout(400);
await page.screenshot({ path: join(out, "results-reduced-motion-1280x720.png") });

// 2. PRACTICE BARS X–Y opens bar-loop on the bracketed bars at 70%.
const run = await page.getByTestId("duo-run").evaluate((e) => [Number(e.dataset.from), Number(e.dataset.to)]).catch(() => null);
const label = await text("duo-practice");
check(run?.[0] === 9 && run?.[1] === 12, `the bracket is on the planted bars 9–12 (${run})`);
check(run !== null && label === `PRACTICE ${run[0] === run[1] ? `BAR ${run[0]}` : `BARS ${run[0]}–${run[1]}`}`, `the button names the bracketed bars ("${label}", bracket ${run})`);
await page.getByTestId("duo-practice").click();
await page.waitForURL(/from=/, { timeout: 30_000 }).catch(() => {});
const q = new URL(page.url()).searchParams;
check(
  run !== null && q.get("song") === "fur-elise" && q.get("from") === String(run[0]) && q.get("to") === String(run[1]) && q.get("tempo") === "70",
  `PRACTICE opens ${page.url().replace(base, "")}`,
);
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

await browser.close();
say(failures.length ? `verify-results: FAIL (${failures.length})` : "verify-results: pass");
process.exit(failures.length ? 1 : 0);
