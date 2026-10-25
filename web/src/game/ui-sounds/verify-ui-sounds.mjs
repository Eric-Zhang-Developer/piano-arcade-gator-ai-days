// Browser proof of ui-sounds (spec: ui-sounds, Validation): a production build in headless Chromium, with a page-side
// spy logging every OscillatorNode.start. song-preview's tones start 400 ms after a row settles, so the steps count
// only starts within 100 ms of a press (step 3 sorts by pitch instead).
// 1. Load / and press nothing -> no starts.  2. ↓ three times, 150 ms apart -> three moves; ↓ on the last song -> none.
// 3. Enter -> a confirm, then one sting when the stage card shows.  4. Mute on the start screen, back to /, ↓ -> none.
// Also: a direct load of /play gets no sting (no gesture yet).
// Usage: node web/src/game/ui-sounds/verify-ui-sounds.mjs --out <dir> [--no-build]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-ui-sounds.mjs --out <dir> [--no-build]");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

if (!process.argv.includes("--no-build")) {
  say("verify-ui-sounds: next build");
  const b = spawnSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) {
    say("verify-ui-sounds: the build failed");
    process.exit(1);
  }
}
const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(webDir, "node_modules/.bin/next"), ["start", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
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

const spy = () => {
  window.__oscStarts = [];
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...a) {
    window.__oscStarts.push({ at: performance.now(), hz: this.frequency.value });
    return start.apply(this, a);
  };
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(spy);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
for (let i = 0; ; i++) {
  try {
    // ?midi=off: no piano at all. Without it, laptop-sound's virtual "Portable Grand" plays song-preview's openings,
    // starting each note's oscillators as it sounds, so they land inside a key's 100 ms window (spec: laptop-sound).
    await page.goto(`${base}/?midi=off`);
    break;
  } catch (e) {
    if (i > 60) throw e;
    await page.waitForTimeout(1000); // the server is still starting
  }
}
await page.locator("ol a").first().waitFor({ timeout: 30_000 });
const now = () => page.evaluate(() => performance.now());
const startsIn = (from, to) => page.evaluate(([a, b]) => window.__oscStarts.filter((s) => s.at >= a && s.at < b).length, [from, to]);
// Presses a key; returns the oscillator starts within 100 ms of it.
const press = async (key) => {
  const t = await now();
  await page.keyboard.press(key);
  await page.waitForTimeout(120);
  return startsIn(t, t + 100);
};

// 1
await page.waitForTimeout(2000);
check((await page.evaluate(() => window.__oscStarts.length)) === 0, "1: loading / and pressing nothing starts no oscillator");

// 2
const moves = [];
for (let i = 0; i < 3; i++) {
  moves.push(await press("ArrowDown"));
  await page.waitForTimeout(30); // 150 ms apart with press()'s 120
}
check(moves.every((n) => n === 1), `2: three ↓ presses -> one start each (${moves.join(", ")})`);
await page.locator("ol a").last().focus();
await page.waitForTimeout(600);
check((await press("ArrowDown")) === 0, "2: ↓ on the last song -> no start");

// 3
await page.locator("ol a").first().focus();
await page.waitForTimeout(150);
const enterAt = await now();
await page.keyboard.press("Enter");
await page.locator('section[aria-label="Stage"]').waitFor({ timeout: 30_000 });
await page.waitForTimeout(800);
// The stage card often shows within 100 ms of Enter, so the two are told apart by pitch: confirm is G5 and C6
// (784, 1047 Hz), the sting C4 to C5 (262–523 Hz).
const after = await page.evaluate((t) => window.__oscStarts.filter((s) => s.at >= t).map((s) => s.hz), enterAt);
const confirm = after.filter((hz) => hz > 700).length;
const sting = after.filter((hz) => hz < 600).length;
check(confirm === 2, `3: Enter -> a confirm (2 notes, got ${confirm})`);
check(sting === 4 && after.length === 6, `3: the stage card -> one sting (4 notes, got ${sting}; ${after.length} starts in all)`);

// 4
await page.getByLabel("Mute").check();
await page.goBack();
await page.locator("ol a").first().waitFor({ timeout: 30_000 });
await page.locator("ol a").first().focus();
await page.waitForTimeout(600);
check((await press("ArrowDown")) === 0, "4: muted on the start screen, back on / ↓ -> no start");
await page.goBack(); // leave the next context's mute alone: storage is per context
await context.close();

// A direct load of /play: no gesture yet, so no sting.
const direct = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await direct.addInitScript(spy);
const p2 = await direct.newPage();
await p2.goto(`${base}/play?song=twinkle`);
await p2.locator('section[aria-label="Stage"]').waitFor({ timeout: 30_000 });
await p2.waitForTimeout(800);
check((await p2.evaluate(() => window.__oscStarts.length)) === 0, "direct load of /play -> no sting");
await direct.close();

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-ui-sounds.json"), JSON.stringify({ failures }, null, 2));
await browser.close();
say(failures.length ? `verify-ui-sounds: ${failures.length} failed` : "verify-ui-sounds: pass");
process.exit(failures.length ? 1 : 0);
