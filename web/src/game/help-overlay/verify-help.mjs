// Headless proof of the help overlay (spec: help-overlay, Validation). Its own `next dev`:
// 1. /, ? -> the card opens with the focus inside and lists L and Z / X; Esc -> closed, focus back on the song card.
// 2. /play?song=twinkle: ? on the start screen -> open; close, Start, ? mid-take -> no card, the take goes on;
//    Esc (pause), ? -> no card.
// 3. bot=perfect's results -> ? opens it. Screenshots of the card at 1280×720 and 1920×1080, and under reduced motion.
// Usage: node web/src/game/help-overlay/verify-help.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-help.mjs --out <dir>");
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
say(`verify-help: starting next dev on ${port}`);
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
const open = (page) => page.evaluate(() => !!document.querySelector('[data-testid="help"]')?.open);
const focusInside = (page) => page.evaluate(() => !!document.activeElement?.closest('[data-testid="help"]'));
const help = async (page) => {
  await page.keyboard.press("?");
  await page.waitForTimeout(300);
  return open(page);
};
const start = (page) => page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves

const browser = await chromium.launch({ headless: true });
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const errors = [];

  // 1. The music select, at both sizes.
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByTestId("song-twinkle").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    check(await help(page), `1 (${w}): / ? -> the card opens`);
    check(await focusInside(page), `1 (${w}): the focus is inside the card`);
    const text = await page.getByTestId("help").innerText();
    check(/\bL\b/.test(text) && /\bZ\b/.test(text) && /\bX\b/.test(text), `1 (${w}): it lists L and Z / X`);
    await page.screenshot({ path: join(out, `help-select-${w}.png`) });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    check(!(await open(page)), `1 (${w}): Esc -> closed`);
    const back = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName);
    check(String(back).startsWith("song-"), `1 (${w}): the focus is back on the song card (${back})`);
    await page.close();
  }

  // 2. /play: the start screen opens it; a take and its pause menu don't.
  const play = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  play.on("pageerror", (e) => errors.push(e.message));
  await play.goto(`${base}/play?song=twinkle&beat=off`);
  await play.getByRole("button", { name: "Start" }).waitFor({ timeout: 60_000 });
  check(await help(play), "2: ? on the start screen -> the card opens");
  await play.keyboard.press("Escape");
  await play.waitForTimeout(300);
  check(!(await open(play)), "2: Esc -> closed, still on the start screen");
  await start(play);
  await play.waitForTimeout(1500);
  check(!(await help(play)), "2: ? mid-take -> no card");
  check((await play.getByTestId("pause").count()) === 0, "2: the take goes on (no pause menu)");
  await play.keyboard.press("Escape");
  await play.getByTestId("pause").waitFor({ timeout: 5000 }).catch(() => {});
  check((await play.getByTestId("pause").count()) === 1, "2: Esc pauses");
  check(!(await help(play)), "2: ? on the pause menu -> no card");
  await play.close();

  // 3. The results, at 1280×720 and with reduced motion.
  for (const motion of ["no-preference", "reduce"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: motion });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/play?song=twinkle&bot=perfect&beat=off`);
    await start(page);
    await page.getByTestId("results").waitFor({ timeout: 120_000 });
    await page.waitForTimeout(2500); // past the results' tally and rank stamp
    check(await help(page), `3${motion === "reduce" ? " (reduced motion)" : ""}: ? on the results -> the card opens`);
    if (motion === "reduce") {
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.('[data-testid="help"]')).length);
      check(running === 0, `3 (reduced motion): no animation on the card (${running})`);
    }
    await page.screenshot({ path: join(out, `help-results-1280${motion === "reduce" ? "-reduce" : ""}.png`) });
    await page.close();
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} catch (e) {
  failures.push(e.message);
  say(`FAIL ${e.message}`);
} finally {
  await browser.close();
}
say(failures.length ? `verify-help: ${failures.length} failed` : `verify-help: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
