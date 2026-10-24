// Headless proof of song preview (spec: song-preview, the Chrome steps). On /: nothing sounds before a key press; ↓
// shows the panel and plays the opening as tones; ↓ again stops it and starts the next; PRACTICE 70% opens bar-loop.
// Then with a stand-in "Portable Grand" MIDI output: the opening goes to the piano on channel 1, and moving on sends
// All Notes Off, and L (learn-from-select) does the same on its way to wait mode.
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

// Counts the tones started and the buses disconnected; with `piano`, a stand-in DGX records every MIDI send.
const instrument = (piano) => {
  window.__tones = 0;
  window.__disconnects = 0;
  const osc = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () {
    window.__tones++;
    return osc.call(this);
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

async function open(page) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/`);
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
    return c.notes.filter((n) => n.beat < 2 * c.beatsPerBar).length;
  }, id);

const browser = await chromium.launch({ headless: true });
const errors = [];

// Tones.
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(instrument, false);
await open(page);
await page.waitForTimeout(1500);
check((await page.getByTestId("preview-status").textContent()) === "Press any key for previews", "before a key press the panel says 'Press any key for previews'");
check((await page.evaluate(() => window.__tones + window.__midiAsked)) === 0, "nothing plays and no MIDI is asked for on page load");
const list = (await page.locator("ol a").evaluateAll((as) => as.map((a) => a.getAttribute("href").replace("/play?song=", ""))));
await page.keyboard.press("ArrowDown");
await page.getByTestId("preview-status").filter({ hasText: "laptop tones" }).waitFor({ timeout: 10_000 });
const second = list[1];
check(/\d/.test(await page.getByTestId("preview-nps").textContent()), `↓ shows ${second}'s notes per second (${await page.getByTestId("preview-nps").textContent()})`);
const want = await opening(page, second);
check((await page.evaluate(() => window.__tones)) === want, `its opening plays as tones: ${await page.evaluate(() => window.__tones)} of ${want} notes in bars 1–2`);
await page.screenshot({ path: join(out, "preview-tones.png") });
const before = await page.evaluate(() => [window.__tones, window.__disconnects]);
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
check((await page.evaluate(() => window.__disconnects)) > before[1], "↓ again mid-preview stops the first (its bus is disconnected)");
await page.waitForFunction((n) => window.__tones > n, before[0], { timeout: 10_000 });
check(true, `… and ${list[2]}'s opening starts`);
await page.getByTestId("preview-practice").click();
await page.waitForURL(/tempo=70/);
const url = new URL(page.url());
check(url.searchParams.get("song") === list[2] && url.searchParams.get("from") === "1" && url.searchParams.get("passes") === "1", `PRACTICE 70% opens ${url.pathname}${url.search}`);
await page.getByText("at 70%").first().waitFor({ timeout: 30_000 });
check(true, "… bar-loop at 70%");
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
check(ons === want, `on the piano: ${ons} note-ons on channel 1 for ${want} notes`);
check((await page.evaluate(() => window.__tones)) === 0, "… and no laptop tones");
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(100);
const tail = await page.evaluate(() => window.__sent.slice(window.__sent.findIndex((m) => m[0] === "clear")));
check(tail[0]?.[0] === "clear" && JSON.stringify(tail[1]) === JSON.stringify([0xb0, 123, 0]), "moving on clears the queue and sends All Notes Off");
// L (learn-from-select) leaves for wait mode and stops the opening at once, as Enter does.
await page.getByTestId("preview-status").filter({ hasText: "on the piano" }).waitFor({ timeout: 10_000 });
await page.waitForFunction(() => window.__sent.at(-1)?.[0] === 0x80 || window.__sent.at(-1)?.[0] === 0x90, null, { timeout: 10_000 });
const mark = await page.evaluate(() => window.__sent.length);
await page.keyboard.press("l");
await page.waitForURL(/mode=wait/, { timeout: 15_000 });
const afterL = await page.evaluate((n) => window.__sent.slice(n), mark);
check(afterL[0]?.[0] === "clear" && JSON.stringify(afterL[1]) === JSON.stringify([0xb0, 123, 0]), `L clears the queue and sends All Notes Off, then opens ${new URL(page.url()).search}`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-preview.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-preview: ${failures.length} failed` : "verify-preview: all checks passed");
process.exit(failures.length ? 1 : 0);
