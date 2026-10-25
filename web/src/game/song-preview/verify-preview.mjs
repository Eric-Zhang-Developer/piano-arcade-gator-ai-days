// Headless proof of song preview (spec: song-preview, the Chrome steps). On /?midi=off: nothing sounds before a key press; ↓
// plays the opening as tones; ↓ again stops it and starts the next. (Level, notes, best and PRACTICE live in duo-select's
// panel, and its own check covers them.)
// Then with a stand-in "Portable Grand" MIDI output: the opening goes to the piano on channel 1 a few notes at a time
// (never queued whole: a real piano plays a timestamped note even after All Notes Off), moving on lifts the keys and
// sends All Notes Off and nothing more, and L (learn-from-select) does the same on its way to wait mode.
// Usage: node web/src/game/song-preview/verify-preview.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-preview.mjs --out <dir>");
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
say(`verify-preview: starting next dev on ${port}`);
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

// Counts the tones started (oscillators and, for UI sounds, buffer sources) and the buses disconnected; with `piano`, a stand-in DGX records every MIDI send. A tone
// started inside a key's dispatch is a UI sound (ui-sounds' ↓ blip runs in the list's keydown handler), counted in
// __uiTones; the preview starts its tones from a timer previewSettings.delayMs later, counted in __tones (#428).
const instrument = (piano) => {
  window.__tones = 0;
  window.__uiTones = 0;
  window.__disconnects = 0;
  let inKey = false;
  window.addEventListener(
    "keydown",
    () => {
      inKey = true;
      setTimeout(() => (inKey = false));
    },
    true,
  );
  const osc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    if (inKey) window.__uiTones++;
    else window.__tones++;
    return osc.call(this);
  };
  // Since ui-sound-family (#1169) every UI sound is one rendered buffer: each buffer source is a UI tone, wherever it
  // starts (song-preview's tones are still oscillators).
  const buf = BaseAudioContext.prototype.createBufferSource;
  BaseAudioContext.prototype.createBufferSource = function () {
    window.__uiTones++;
    return buf.call(this);
  };
  const disc = AudioNode.prototype.disconnect;
  AudioNode.prototype.disconnect = function (...a) {
    window.__disconnects++;
    return disc.apply(this, a);
  };
  window.__midiAsked = 0;
  window.__sent = [];
  const fake = { name: "Digital Piano Portable Grand", send: (m) => window.__sent.push([...m]), clear: () => window.__sent.push(["clear"]) };
  navigator.requestMIDIAccess = () => {
    window.__midiAsked++;
    return piano ? Promise.resolve({ outputs: new Map([["dgx", fake]]) }) : Promise.reject(new Error("no MIDI here"));
  };
};

async function open(page, path = "/") {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.getByTestId("song-preview").waitFor({ timeout: 60_000 });
}
const opening = (page, id) =>
  page.evaluate(async (id) => {
    const c = await (await fetch(`/songs/${id}/chart.json`)).json();
    const first = Math.min(...c.notes.map((n) => n.beat));
    return c.notes.filter((n) => ((n.beat - first) * 60000) / c.bpm < 5000).length; // the first 5 s, from the first note

  }, id);

const browser = await chromium.launch({ headless: true });
const errors = [];

// Tones.
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(instrument, false);
// ?midi=off: no piano at all. Without it, laptop-sound's virtual "Portable Grand" stands in and the opening plays
// through it instead of tones (spec: laptop-sound).
await open(page, "/?midi=off");
await page.waitForTimeout(1500);
check((await page.getByTestId("preview-status").textContent()).trim() === "", "before a key press the status line is blank (mouse-first: no 'Press any key' line)");
check((await page.evaluate(() => window.__tones + window.__uiTones + window.__midiAsked)) === 0, "nothing plays and no MIDI is asked for on page load");
const list = (await page.locator("ol a").evaluateAll((as) => as.map((a) => a.getAttribute("href").replace("/play?song=", ""))));
await page.keyboard.press("ArrowDown");
await page.getByTestId("preview-status").filter({ hasText: "laptop tones" }).waitFor({ timeout: 10_000 });
const second = list[1];
const want = await opening(page, second);
check((await page.evaluate(() => window.__tones)) === want, `its opening plays as tones: ${await page.evaluate(() => window.__tones)} of ${want} notes in its first 5 s`);
check((await page.evaluate(() => window.__uiTones)) === 1, `… apart from ui-sounds' one ↓ blip (${await page.evaluate(() => window.__uiTones)} UI tones)`);
await page.screenshot({ path: join(out, "preview-tones.png") });
const before = await page.evaluate(() => [window.__tones, window.__disconnects]);
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
check((await page.evaluate(() => window.__disconnects)) > before[1], "↓ again mid-preview stops the first (its bus is disconnected)");
await page.waitForFunction((n) => window.__tones > n, before[0], { timeout: 10_000 });
check(true, `… and ${list[2]}'s opening starts`);
await page.close();

// The piano.
page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(instrument, true);
await open(page);
await page.keyboard.press("ArrowDown");
await page.getByTestId("preview-status").filter({ hasText: "on the piano" }).waitFor({ timeout: 10_000 });
await page.waitForTimeout(300);
const ons = await page.evaluate(() => window.__sent.filter((m) => m[0] === 0x90).length);
check(ons > 0 && ons < want, `on the piano: ${ons} of ${want} note-ons sent so far, on channel 1, not the whole opening at once`);
check((await page.evaluate(() => window.__tones)) === 0, "… and no laptop tones");
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
// A stop: clear, a note-off per pressed key, All Notes Off, and no note-on after it.
const stops = (sent) => sent[0]?.[0] === "clear" && sent.slice(1).every((m) => m[0] !== 0x90) && sent.some((m) => JSON.stringify(m) === JSON.stringify([0xb0, 123, 0]));
const tail = await page.evaluate(() => window.__sent.slice(window.__sent.findIndex((m) => m[0] === "clear")));
check(stops(tail), "moving on lifts the keys and sends All Notes Off, and no note-on follows");
// L (learn-from-select) leaves for wait mode and stops the opening at once, as Enter does.
await page.getByTestId("preview-status").filter({ hasText: "on the piano" }).waitFor({ timeout: 10_000 });
await page.waitForFunction(() => window.__sent.at(-1)?.[0] === 0x80 || window.__sent.at(-1)?.[0] === 0x90, null, { timeout: 10_000 });
const mark = await page.evaluate(() => window.__sent.length);
await page.keyboard.press("l");
await page.waitForURL(/mode=wait/, { timeout: 15_000 });
const afterL = await page.evaluate((n) => window.__sent.slice(n), mark);
check(stops(afterL.slice(afterL.findIndex((m) => m[0] === "clear"))), `L clears the queue and sends All Notes Off, then opens ${new URL(page.url()).search}`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-preview.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-preview: ${failures.length} failed` : "verify-preview: all checks passed");
process.exit(failures.length ? 1 : 0);
