// Headless proof of flow mode (spec: flow-mode, Validation 2): on /play?mode=flow Twinkle's first note holds the clock
// with no presses and "Take your time" shows after 2 beats; then the whole song played at 80% of its tempo, pressed at
// wall-clock times with pressNow, ends with no MISS, the rate near 0.80 by the 8th note and a "steady" headline.
// Usage: node web/src/game/flow-mode/verify-flow.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-flow.mjs --out <dir>");
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
say(`verify-flow: starting next dev on ${port}`);
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
// The same moment at both sizes: the canvases resize on the window's resize event.
async function shots(page, name) {
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, `${name}-${w}x${h}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (let i = 0; ; i++) {
  try {
    await page.goto(`${base}/play?song=twinkle&mode=flow&input=test&stage=off`);
    break;
  } catch (e) {
    if (i > 60) throw e;
    await page.waitForTimeout(1000); // the dev server is still starting
  }
}
await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
const chart = await page.evaluate(() => window.__pianoArcade.chart);
const mpb = 60000 / chart.bpm;
const first = Math.min(...chart.notes.map((n) => n.beat)) * mpb;

// 1. No presses: from the count-in's end, 3 s of frames never pass the first note, and the clock holds.
await page.waitForFunction((t) => window.__pianoArcade.now() >= t - 1, first, { timeout: 30_000 });
const hold = await page.evaluate(async () => {
  const start = performance.now();
  let max = -Infinity;
  let calmAt = null;
  while (performance.now() - start < 3000) {
    await new Promise(requestAnimationFrame);
    max = Math.max(max, window.__pianoArcade.now());
    if (calmAt === null && window.__pianoArcadeFlow?.calm) calmAt = performance.now() - start;
  }
  return { max, calmAt, flow: window.__pianoArcadeFlow };
});
check(hold.max <= first + 1e-6, `no presses for 3 s: the clock stays at or before the first note (max ${hold.max.toFixed(1)} ms, note ${first} ms)`);
check(hold.flow?.holding === true, `the clock holds (holding ${hold.flow?.holding})`);
check(hold.calmAt !== null && hold.calmAt >= 2 * mpb - 100, `"Take your time" shows after 2 beats (at ${hold.calmAt?.toFixed(0)} ms; 2 beats = ${2 * mpb} ms)`);
check(hold.flow?.slips === 0, `waiting at the first note is no slip (slips ${hold.flow?.slips})`);
await shots(page, "flow-hold");

// 2. The whole song at 80%: each onset pressed at its wall time, the first one now.
const onsets = [...new Set(chart.notes.map((n) => n.beat))].sort((a, b) => a - b);
const byBeat = onsets.map((b) => chart.notes.filter((n) => n.beat === b).map((n) => n.pitch));
const rateAt8 = await page.evaluate(
  async ({ onsets, byBeat, mpb }) => {
    const t0 = performance.now();
    let rate8 = null;
    for (let k = 0; k < onsets.length; k++) {
      const at = t0 + ((onsets[k] - onsets[0]) * mpb) / 0.8;
      while (performance.now() < at) await new Promise((r) => setTimeout(r, 1));
      for (const p of byBeat[k]) window.__pianoArcade.pressNow(p);
      if (k === 7) {
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        rate8 = window.__pianoArcadeFlow.rate; // the 8th note: 7 tempo samples, the last 4 in the mean
      }
    }
    return rate8;
  },
  { onsets, byBeat, mpb },
);
check(rateAt8 !== null && Math.abs(rateAt8 - 0.8) <= 0.05, `rate is 0.80 ± 0.05 by the 8th note (${rateAt8?.toFixed(3)})`);
await page.getByTestId("results").waitFor({ timeout: 120_000 });
const r = await page.evaluate(() => window.__pianoArcade.results);
check(r.counts.MISS === 0, `no MISS (${r.counts.MISS})`);
const head = await page.getByTestId("flow-headline").textContent({ timeout: 10_000 }).catch(() => null);
check(head !== null && head.includes("steady") && !head.includes("a bit"), `the headline says steady ("${head}")`);
check((await page.getByTestId("rank").count()) === 1, "the take is scored: the rank shows");
await shots(page, "flow-results");
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

await browser.close();
say(failures.length ? `verify-flow: FAIL (${failures.length})` : "verify-flow: pass");
process.exit(failures.length ? 1 : 0);
