// verify-audio (spec: audio-track): a local song's recording plays in sync under /play.
// The default song is a click track this script writes itself into songs/local/audio-test/ (gitignored, so nothing
// with audio is committed): 120 bpm, a 1.5 s lead-in, one note a beat. It starts its own next dev, plays the take the
// way a player does (Start, Esc, Resume, Quit; ?input=test can't pause) and checks:
//   1. the recording plays by chart time 0, and its heard position tracks fileTimeAt within 20 ms, each second for 20 s;
//   2. after a pause and a resume it is silent while paused, then back within 20 ms;
//   3. Quit silences it at once.
// Usage: node verify-audio.mjs --out <dir> [--song local/<id>]   (another local song: Golden, say)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const TOLERANCE_MS = 20;
const SAMPLES = 20;
const FIXTURE = { id: "audio-test", bpm: 120, leadInMs: 1500, beats: 96, rate: 44100 };

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const song = arg("--song", `local/${FIXTURE.id}`);
const out = resolve(arg("--out", "verify-audio-out"));
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

// The click track: a 10 ms 1 kHz burst on every beat after the lead-in, 16-bit mono WAV.
function writeFixture() {
  const { bpm, leadInMs, beats, rate } = FIXTURE;
  const mpb = 60000 / bpm;
  const samples = Math.ceil(((leadInMs + beats * mpb + 2000) / 1000) * rate);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let b = 0; b < beats; b++) {
    const start = Math.round(((leadInMs + b * mpb) / 1000) * rate);
    for (let i = 0; i < rate / 100; i++) wav.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * 1000 * i) / rate)), 44 + (start + i) * 2);
  }
  const dir = join(webDir, "public/songs/local", FIXTURE.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "click.wav"), wav);
  writeFileSync(join(dir, "audio.json"), JSON.stringify({ src: "click.wav", offsetMs: leadInMs }));
  const notes = Array.from({ length: beats }, (_, b) => ({ id: `n${b + 1}`, pitch: 60 + (b % 4) * 2, beat: b, duration: 0.5, hand: "R" }));
  writeFileSync(
    join(dir, "chart.json"),
    JSON.stringify({ id: `local/${FIXTURE.id}`, title: "Audio test", composer: "Piano Arcade", source: "verify-audio's generated click track", bpm, beatsPerBar: 4, notes }),
  );
}
if (song === `local/${FIXTURE.id}`) writeFixture();

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-audio: starting next dev on ${port}`);
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

const fail = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) fail.push(line);
};
// Headless Chrome starts audio without a gesture with this flag; a person's Start click does the same.
const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const audio = (page) =>
  page.evaluate(() => {
    const a = window.__pianoArcadeAudio;
    const chartMs = a?.chartMs() ?? null;
    return { loaded: !!a?.loaded, playing: !!a?.playing, chartMs, want: chartMs === null ? null : a.fileTimeAt(chartMs), heard: a?.positionMs() ?? null };
  });
const drift = (rows) => Math.max(...rows.map((r) => (r.heard === null || r.want === null ? Infinity : Math.abs(r.heard - r.want))));
const samples = async (page, n) => {
  const rows = [];
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(1000);
    rows.push(await audio(page));
  }
  return rows;
};

try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(base).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/play?song=${encodeURIComponent(song)}`);
  const loaded = await page.waitForFunction(() => window.__pianoArcadeAudio?.loaded, null, { timeout: 60_000 }).then(() => true, () => false);
  check(loaded, `${song}: the recording decodes`);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForFunction(() => (window.__pianoArcadeAudio?.chartMs() ?? -1) >= 0, null, { timeout: 30_000 });
  const atZero = await audio(page);
  check(atZero.playing, `1. playing at chart time 0 (chart ${atZero.chartMs?.toFixed(0)} ms)`);
  const rows = await samples(page, SAMPLES);
  writeFileSync(join(out, "samples.json"), JSON.stringify(rows, null, 1));
  check(drift(rows) <= TOLERANCE_MS, `1. the heard position tracks fileTimeAt within ${TOLERANCE_MS} ms, ${SAMPLES} s (worst ${drift(rows).toFixed(1)} ms)`);

  await page.keyboard.press("Escape");
  await page.getByTestId("pause").waitFor({ timeout: 5000 });
  await page.waitForTimeout(300);
  check(!(await audio(page)).playing, "2. paused: silent");
  await page.waitForTimeout(1500);
  await page.getByRole("menuitem", { name: "Resume", exact: true }).click();
  const back = await page.waitForFunction(() => window.__pianoArcadeAudio?.playing, null, { timeout: 10_000 }).then(() => true, () => false);
  const after = back ? await samples(page, 3) : [];
  check(back && drift(after) <= TOLERANCE_MS, `2. resumed within ${TOLERANCE_MS} ms of fileTimeAt (worst ${back ? drift(after).toFixed(1) : "-"} ms)`);

  await page.keyboard.press("Escape");
  await page.getByTestId("pause").waitFor({ timeout: 5000 });
  await page.getByRole("menuitem", { name: "Resume", exact: true }).click(); // the countdown, then playing again
  await page.waitForFunction(() => window.__pianoArcadeAudio?.playing, null, { timeout: 10_000 });
  await page.keyboard.press("Escape");
  await page.getByTestId("pause").waitFor({ timeout: 5000 });
  await page.getByRole("menuitem", { name: "Quit", exact: true }).click();
  await page.waitForTimeout(100);
  check(!(await audio(page)).playing, "3. Quit: silent at once");
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} catch (e) {
  check(false, `crashed: ${e.message}`);
} finally {
  await browser.close();
}
say(fail.length ? `verify-audio: FAIL\n  ${fail.join("\n  ")}` : "verify-audio: pass");
process.exit(fail.length ? 1 : 0);
