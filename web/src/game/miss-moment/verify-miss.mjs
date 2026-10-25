// Headless proof of miss-moment (spec Validation): a rank-C bot plays Twinkle with the luminance probe on. Every missed
// note's tail is gone within 300 ms; a miss moves the playfield's luminance less than a GOOD hit does; under emulated
// reduced motion a tail only changes opacity (full width throughout); the miss cue sits 18 dB or more under the piano;
// no console error. Not run locally (AGENTS.md load rule); CI's browser suite runs it.
// Usage: node web/src/game/miss-moment/verify-miss.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-miss.mjs --out <dir>");
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
say(`verify-miss: starting next dev on ${port}`);
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
for (let end = Date.now() + 120_000; ; ) {
  if (Date.now() > end) throw new Error("server not ready after 120 s");
  if (await fetch(`${base}/play`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const fail = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) fail.push(line);
};

/** For each event: the mean luminance over the 300 ms after it, minus the mean over the 100 ms before. */
export function lumaChange(frames, atMs) {
  const mean = (a, b) => {
    const xs = frames.filter((f) => f.nowMs >= a && f.nowMs < b).map((f) => f.luma);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
  };
  const before = mean(atMs - 100, atMs);
  const after = mean(atMs, atMs + 300);
  return before === null || after === null ? null : after - before;
}
const average = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

async function take(browser, reducedMotion) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(() => (window.__pianoArcadeMiss = { frames: [] }));
  await page.goto(`${base}/play?song=twinkle&bot=rank-c`);
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 60_000 });
  await start.click();
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  const probe = await page.evaluate(() => window.__pianoArcadeMiss);
  const cue = reducedMotion === "no-preference" ? await page.evaluate(() => window.__pianoArcadeMissCue?.()) : null;
  await page.screenshot({ path: join(out, `results-${reducedMotion}.png`) });
  await context.close();
  return { probe, cue, errors };
}

const browser = await chromium.launch({ headless: true });
try {
  const plain = await take(browser, "no-preference");
  const { frames, events = [] } = plain.probe;
  const misses = events.filter((e) => e.type === "noteMiss");
  // The weakest hit tier the bot makes: rank-c Twinkle gives no GOOD (23 PERFECT, 11 GREAT, 8 MISS when measured), so
  // the bar compares a miss with a GREAT then (decision miss-moment-curves).
  const tier = ["GOOD", "GREAT", "PERFECT"].find((j) => events.some((e) => e.type === "noteHit" && e.judgment === j));
  const goods = events.filter((e) => e.type === "noteHit" && e.judgment === tier);
  const tails = frames.flatMap((f) => f.tails);
  check(misses.length > 0 && goods.length > 0 && frames.length > 100, `rank-c Twinkle: ${misses.length} misses, ${goods.length} ${tier} hits, ${frames.length} frames logged`);
  const oldest = Math.max(0, ...tails.map((t) => t.t));
  check(tails.length > 0 && oldest < 300, `every missed note's tail is gone within 300 ms (oldest drawn: ${oldest.toFixed(0)} ms)`);

  const change = (list) => list.map((e) => lumaChange(frames, e.atMs)).filter((x) => x !== null).map(Math.abs);
  const missD = change(misses);
  const goodD = change(goods);
  const m = average(missD);
  const g = average(goodD);
  check(missD.length > 0 && goodD.length > 0 && m < g, `a miss moves the playfield less than a ${tier}: |Δluma| ${m.toFixed(4)} vs ${g.toFixed(4)}`);

  const cue = plain.cue;
  check(cue && cue.underDb >= 18, `the miss cue is ${cue?.underDb.toFixed(1)} dB under the piano (cue ${cue?.cueDb.toFixed(1)} dB, piano ${cue?.pianoDb.toFixed(1)} dB)`);
  check(plain.errors.length === 0, `no console error${plain.errors.length ? `: ${plain.errors.join("; ")}` : ""}`);

  const calm = await take(browser, "reduce");
  const calmTails = calm.probe.frames.flatMap((f) => f.tails);
  check(calmTails.length > 0 && calmTails.every((t) => t.width === 1), `reduced motion: tails change opacity only (${calmTails.length} drawn, all full width)`);
  check(calm.errors.length === 0, `reduced motion: no console error${calm.errors.length ? `: ${calm.errors.join("; ")}` : ""}`);

  writeFileSync(join(out, "verify-miss.json"), JSON.stringify({ fail, misses: misses.length, goods: goods.length, missDelta: m, goodDelta: g, cue }, null, 2));
} finally {
  await browser.close();
}
say(fail.length ? `verify-miss: ${fail.length} failed` : "verify-miss: pass");
process.exit(fail.length ? 1 : 0);
