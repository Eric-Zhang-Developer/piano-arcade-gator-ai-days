// Headless proof of hand mode on Für Elise with ?hands=R, the fake piano (?midi=sim) and test input: the judged chart
// holds only the right hand and the Perfect player gets all PERFECT on it; the fake piano's output receives every
// left-hand note on channel 1, spaced exactly as the chart and starting on time, with the chart's velocities; and
// All Notes Off follows the song. Chart zero is checked against beat-track's first kick (chart time 0, sent to the same
// fake piano on channel 10). A screenshot shows the right-hand-only highway.
// Usage: node web/src/game/hand-mode/verify-hands.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-hands.mjs --out <dir>");
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
const url = `http://localhost:${port}/play?song=fur-elise&hands=R&midi=sim&input=test`;
say(`verify-hands: starting next dev on ${port}`);
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
let failed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const full = JSON.parse((await (await fetch(url.replace(/\/play.*/, "/songs/fur-elise/chart.json"))).text()));
  const left = full.notes.filter((n) => n.hand === "L").sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  const mpb = 60000 / full.bpm;

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  await page.waitForTimeout(8000);
  await page.screenshot({ path: join(out, "hands-R-highway.png") });
  await page.waitForSelector('[data-testid="results"]', { timeout: 120_000 });
  await page.waitForTimeout(500);
  const results = await page.evaluate(() => window.__pianoArcade.results);
  const { sent } = await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess();
    const output = [...access.outputs.values()][0];
    return { sent: output.sent.map((s) => ({ data: [...s.data], at: s.timestamp ?? null })) };
  });

  const fail = [];
  const rightCount = full.notes.filter((n) => n.hand === "R").length;
  if (chart.notes.length !== rightCount || chart.notes.some((n) => n.hand !== "R")) fail.push(`judged chart: ${chart.notes.length} notes, want ${rightCount} right-hand notes`);
  if (results.counts.PERFECT !== rightCount || results.counts.MISS !== 0) fail.push(`results ${JSON.stringify(results.counts)}, want ${rightCount} PERFECT`);
  const ons = sent.filter((s) => s.data[0] === 0x90).sort((a, b) => a.at - b.at || a.data[1] - b.data[1]);
  if (ons.length !== left.length) fail.push(`${ons.length} channel-1 note-ons sent, want ${left.length} left-hand notes`);
  const zero = ons[0].at - left[0].beat * mpb;
  const worst = Math.max(...left.map((n, i) => Math.abs(ons[i].at - (zero + n.beat * mpb))));
  if (worst > 1) fail.push(`left hand spacing off the chart by up to ${worst.toFixed(1)} ms`);
  const wrongNote = left.findIndex((n, i) => ons[i].data[1] !== n.pitch || ons[i].data[2] !== (n.velocity ?? 80));
  if (wrongNote >= 0) fail.push(`note ${wrongNote}: sent ${JSON.stringify(ons[wrongNote].data)}, chart ${JSON.stringify(left[wrongNote])}`);
  const kick = sent.find((s) => s.data[0] === 0x99 && s.data[1] === 36); // beat-track's first kick: chart time 0
  const vsBeat = kick ? zero - kick.at : NaN;
  if (!(Math.abs(vsBeat) <= 2)) fail.push(`chart zero is ${vsBeat.toFixed(1)} ms from beat-track's first kick`);
  const ano = sent.findIndex((s) => s.data.join() === "176,123,0");
  if (ano < 0 || sent.slice(ano).some((s) => s.data[0] === 0x90)) fail.push("no All Notes Off on channel 1 after the last note");
  fail.push(...errors);
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-hands: pass, ${rightCount} right-hand notes judged all PERFECT; ${ons.length} left-hand notes sent on channel 1, spacing within ${worst.toFixed(1)} ms of the chart, on beat-track's clock (${vsBeat.toFixed(1)} ms from its first kick); All Notes Off after (evidence: ${out})`);
  writeFileSync(join(out, "sent.json"), JSON.stringify({ zero, kick, sent }, null, 1));
} catch (e) {
  failed = true;
  console.error(`verify-hands: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
