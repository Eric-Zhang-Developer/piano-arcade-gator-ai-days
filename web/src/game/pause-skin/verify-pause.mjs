// Browser proof of pause-skin (spec: pause-skin, Validation): a production build in headless Chromium, laptop keys,
// /play?song=twinkle&beat=off (beat-track's clicks share the tick's pitches), and a page-side spy logging each
// AudioBufferSourceNode.start's pitch (read from the buffer) and its scheduled audio time.
// 1. Start, Esc -> PAUSED with Resume focused (screenshots at both sizes and reduced motion); ↓ ↓ Enter -> /.
// 2. Start, Esc, Enter -> the countdown runs 4, 3, 2, 1: one accent click then three ticks, a beat (600 ms) apart on
//    the audio clock; then the menu is gone and play goes on.
// 3. Esc, ↓ Enter (Retry) -> the menu goes and a new take starts on /play.
// Usage: node web/src/game/pause-skin/verify-pause.mjs --out <dir> [--no-build]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-pause.mjs --out <dir> [--no-build]");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

if (!process.argv.includes("--no-build")) {
  say("verify-pause: next build");
  const b = spawnSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) {
    say("verify-pause: the build failed");
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

// Since ui-sound-family (#1169) each UI sound, the countdown's ticks included, is one rendered buffer, not an
// oscillator. So the spy is on AudioBufferSourceNode.start (as verify-ui-sounds.mjs's is), and a buffer's pitch is
// read from its samples: the autocorrelation peak between 1100 and 2200 Hz, snapped to the click or the accent when
// within 4%. The bars below are unchanged.
const spy = () => {
  window.__oscStarts = [];
  const pitch = (d, sr) => {
    let best = 0;
    let lag = 0;
    for (let l = Math.floor(sr / 2200); l <= Math.ceil(sr / 1100); l++) {
      let sum = 0;
      for (let i = 0; i + l < d.length; i++) sum += d[i] * d[i + l];
      if (sum > best) [best, lag] = [sum, l];
    }
    const hz = lag ? sr / lag : 0;
    return [1320, 1760].find((f) => Math.abs(hz - f) / f < 0.04) ?? Math.round(hz); // beatSettings.clickHz, clickAccentHz
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
    const d = this.buffer?.getChannelData(0);
    window.__oscStarts.push({ hz: d ? pitch(d, this.buffer.sampleRate) : 0, when, now: this.context.currentTime });
    return start.call(this, when, ...rest);
  };
};
const CLICK = 1320;
const ACCENT = 1760; // beatSettings.clickHz and clickAccentHz
const SCENE = "/play?song=twinkle&beat=off";

const browser = await chromium.launch({ headless: true });
const errors = [];
async function open(context, path) {
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the server is still starting
    }
  }
  return page;
}
const startTake = async (page) => {
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 30_000 });
  await start.click();
  await page.waitForTimeout(2500); // into the count-in
};

// 1, with screenshots at both sizes and under reduced motion.
for (const [width, height, reduced] of [
  [1280, 720, false],
  [1920, 1080, false],
  [1920, 1080, true],
]) {
  const tag = `${width}x${height}${reduced ? "-reduced" : ""}`;
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await open(context, SCENE);
  await startTake(page);
  await page.keyboard.press("Escape");
  await page.getByTestId("pause").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `paused-${tag}.png`) });
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  check(focused === "Resume", `${tag} 1: Esc -> PAUSED with Resume focused (${focused})`);
  if (!reduced && width === 1280) {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown"); // stops on Quit
    const last = await page.evaluate(() => document.activeElement?.textContent);
    check(last === "Quit", `${tag} 1: ↓ ↓ ↓ stops on Quit (${last})`);
    await page.keyboard.press("Enter");
    await page.waitForURL(`${base}/`, { timeout: 15_000 });
    check(true, `${tag} 1: Enter on Quit opens /`);
  }
  await context.close();
}

// 2 and 3.
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await context.addInitScript(spy);
const page = await open(context, SCENE);
await startTake(page);
await page.keyboard.press("Escape");
await page.getByTestId("pause").waitFor({ timeout: 5000 });
await page.waitForTimeout(300);
// Each number the countdown shows, recorded in the page as the DOM changes (polling from here can miss one).
await page.evaluate(() => {
  window.__oscStarts.length = 0;
  window.__counts = [];
  new MutationObserver(() => {
    const t = document.querySelector('[data-testid="pause-countdown"]')?.textContent;
    if (t && window.__counts.at(-1) !== t) window.__counts.push(t);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
});
await page.keyboard.press("Enter");
await page.getByTestId("pause-countdown").waitFor({ timeout: 5000 });
await page.getByTestId("pause").waitFor({ state: "detached", timeout: 10_000 });
await page.screenshot({ path: join(out, "after-countdown.png") });
const shown = await page.evaluate(() => window.__counts);
check(shown.join(",") === "4,3,2,1", `2: the countdown shows 4, 3, 2, 1 (${shown.join(", ")})`);
const ticks = await page.evaluate(([c, a]) => window.__oscStarts.filter((s) => s.hz === c || s.hz === a), [CLICK, ACCENT]);
const pattern = ticks.map((t) => (t.hz === ACCENT ? "A" : "t")).join("");
check(pattern === "Attt", `2: one accent then three ticks (${pattern})`);
const gaps = ticks.slice(1).map((t, i) => Math.round((t.when - ticks[i].when) * 1000));
check(gaps.length === 3 && gaps.every((g) => Math.abs(g - 600) <= 1), `2: a beat apart on the audio clock (${gaps.join(", ")} ms)`);
check(ticks.length > 0 && Math.abs(ticks[0].when - ticks[0].now) < 0.017, `2: the first click is due within a frame of scheduling (${ticks.length ? Math.round((ticks[0].when - ticks[0].now) * 1000) : "?"} ms)`);
check((await page.getByTestId("pause").count()) === 0, "2: after the countdown the menu is gone and play goes on");

await page.keyboard.press("Escape");
await page.getByTestId("pause").waitFor({ timeout: 5000 });
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const retried = (await page.getByTestId("pause").count()) === 0 && page.url().includes("/play?");
check(retried, "3: Esc, ↓ Enter (Retry) -> the menu goes and a new take starts on /play");
await page.screenshot({ path: join(out, "retry.png") });
await context.close();

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-pause.json"), JSON.stringify({ failures }, null, 2));
await browser.close();
say(`verify-pause: screenshots in ${out}`);
say(failures.length ? `verify-pause: ${failures.length} failed` : "verify-pause: pass");
process.exit(failures.length ? 1 : 0);
