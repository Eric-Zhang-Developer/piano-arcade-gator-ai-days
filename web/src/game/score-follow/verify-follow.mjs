// Headless check of the score-follow spike: /play?song=twinkle&mode=flow&band=follow&midi=sim&input=test, every onset
// pressed with pressNow at 80% tempo. The fake piano (?midi=sim) records what's sent. Pass: band notes on channels 2
// and 10 only, the hi-hats' median asynchrony to the presses within 50 ms, and All Notes Off on both channels after the
// song ends. ?input=test never pauses, so Esc → Quit isn't reachable here; the plugin's vitest covers quit and pause
// (decision score-follow-spike-verify).
// Usage: node web/src/game/score-follow/verify-follow.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-follow.mjs --out <dir>");
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
const url = `http://localhost:${port}/play?song=twinkle&mode=flow&band=follow&midi=sim&input=test&stage=off`;
say(`verify-follow: starting next dev on ${port}`);
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  // Press only once the song has started: flow's clock holds at the first note after the count-in. A press during the
  // count-in comes before songStart, so the band never hears it (the first local run's failure).
  await page.waitForFunction(() => window.__pianoArcadeFlow?.holding === true, null, { timeout: 30_000 });

  // Every onset at 80% tempo, the first one now; the press times, in performance.now().
  const onsets = [...new Set(chart.notes.map((n) => n.beat))].sort((a, b) => a - b);
  const byBeat = onsets.map((b) => chart.notes.filter((n) => n.beat === b).map((n) => n.pitch));
  const presses = await page.evaluate(
    async ({ onsets, byBeat, mpb }) => {
      const t0 = performance.now();
      const at = [];
      for (let k = 0; k < onsets.length; k++) {
        const due = t0 + ((onsets[k] - onsets[0]) * mpb) / 0.8;
        while (performance.now() < due) await new Promise((r) => setTimeout(r, 1));
        at.push(performance.now());
        for (const p of byBeat[k]) window.__pianoArcade.pressNow(p);
      }
      return at;
    },
    { onsets, byBeat, mpb },
  );
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(500);
  const sent = await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess();
    const output = [...access.outputs.values()][0];
    return output.sent.map((s) => ({ data: [...s.data], at: s.timestamp ?? null }));
  });

  const fail = [];
  // The band's channels; channel 1 is the player's (piano-out and the rest), and the plugin's vitest proves it sends none.
  const band = sent.filter((s) => [0x91, 0x81, 0xb1, 0xc1].includes(s.data[0]) || (s.data[0] & 0x0f) === 9);
  const ons = band.filter((s) => (s.data[0] & 0xf0) === 0x90 && s.data[2] > 0);
  const chans = [...new Set(ons.map((s) => (s.data[0] & 0x0f) + 1))].sort((a, b) => a - b);
  if (chans.join() !== "2,10") fail.push(`band note-ons on channels ${chans.join(", ")}, want 2 and 10`);
  // The hi-hat nearest each press (Twinkle's onsets are all on the beat, where every hi-hat falls).
  const hats = ons.filter((s) => s.data[0] === 0x99 && s.data[1] === 42 && s.at !== null).map((s) => s.at);
  const asyncs = presses.map((p) => hats.reduce((best, h) => (Math.abs(h - p) < Math.abs(best) ? h - p : best), Infinity));
  const abs = asyncs.map(Math.abs).sort((a, b) => a - b);
  const median = abs[Math.floor(abs.length / 2)];
  // How many presses landed where the script meant them (gap within 10% of its own): a loaded machine delays the page's
  // timers, and a late press isn't the steady player. Reported, not excluded: the median is over every press.
  const intended = onsets.map((b, k) => (k ? ((b - onsets[k - 1]) * mpb) / 0.8 : 0));
  const onScript = presses.filter((p, k) => k === 0 || Math.abs(p - presses[k - 1] - intended[k]) <= 0.1 * intended[k]).length;
  if (!(median <= 50)) fail.push(`median hi-hat asynchrony ${median?.toFixed(1)} ms, want ≤ 50 (${onScript}/${presses.length} presses on script)`);
  const last = Math.max(...ons.map((s) => sent.indexOf(s)));
  for (const ch of [0xb1, 0xb9]) {
    const ano = sent.findIndex((s, i) => i > last && s.data[0] === ch && s.data[1] === 123);
    if (ano < 0) fail.push(`no All Notes Off on channel ${(ch & 0x0f) + 1} after the band's last note`);
  }
  fail.push(...errors);
  writeFileSync(join(out, "follow.json"), JSON.stringify({ presses, asyncs, sent: band }, null, 1));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-follow: pass, ${ons.length} band notes on channels ${chans.join(" and ")}, hi-hat asynchrony median ${median.toFixed(1)} ms over ${abs.length} presses (max ${abs[abs.length - 1].toFixed(1)}; ${onScript} on script), All Notes Off on both after the song (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-follow: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
