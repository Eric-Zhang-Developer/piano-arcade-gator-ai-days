// Headless proof of laptop sound (spec: laptop-sound, Validation 2), in Chromium with no MIDI devices. Starts its own
// dev server; prints `verify-laptop: pass` and exits 0, or names each failed step and exits 1:
// 1. /play?song=twinkle, Start -> __pianoArcadeLaptop.active, and the status line (in the results screen's Options
//    drawer; /play hides it mid-take) reads "Piano: laptop sound".
// 2. Mid-take, laptop keys A, S, D held -> voices rises with each press, falls to 0 after release. Prints each key's
//    time from the key event to its voice, measured in the page.
// 3. W on Twinkle from the select (watch-demo) -> voices sound through the song, and 0 at the end (no stuck notes).
// 4. ?midi=off -> active is false, and a key press starts no voice.
// Usage: node web/src/game/laptop-sound/verify-laptop.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-laptop.mjs --out <dir>");
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
say(`verify-laptop: starting next dev on ${port}`);
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

async function goto(page, path) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      return;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}

const laptop = (page) => page.evaluate(() => ({ active: window.__pianoArcadeLaptop?.active, voices: window.__pianoArcadeLaptop?.voices }));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

try {
  await goto(page, "/play?song=twinkle");
  await page.getByRole("button", { name: "Start" }).click({ timeout: 90_000 }); // /play starts its devices here
  await page.waitForTimeout(1500); // the take under way, its devices listening
  const s1 = await laptop(page);

  // 2. A, S, D held: one voice each, from the key event itself; released, none.
  await page.evaluate(() => {
    window.__keyToVoice = [];
    // Registered after keysDevice's own window listener, so it runs once that handler has sounded the key.
    window.addEventListener("keydown", (e) => {
      if (!e.repeat) window.__keyToVoice.push({ code: e.code, voices: window.__pianoArcadeLaptop.voices, ms: performance.now() - e.timeStamp });
    });
  });
  const counts = [];
  for (const k of ["a", "s", "d"]) {
    await page.keyboard.down(k);
    counts.push((await laptop(page)).voices);
  }
  for (const k of ["a", "s", "d"]) await page.keyboard.up(k);
  await page.waitForTimeout(100);
  const after = (await laptop(page)).voices;
  const times = await page.evaluate(() => window.__keyToVoice);
  check(counts.join(",") === "1,2,3" && after === 0, `A, S, D: voices ${counts.join(" → ")}, then ${after} after release`);
  for (const t of times) say(`     ${t.code}: key event to voice ${t.ms.toFixed(1)} ms (voices then ${t.voices})`);

  // 1. Laptop sound took over with no piano; the status line says so once the take ends, in the results screen's
  // Options drawer (duo-details #839 moved it there).
  await page.getByTestId("results").waitFor({ timeout: 90_000 });
  await page.getByTestId("options-open").first().click();
  const status = await page.getByText("Piano: laptop sound").waitFor({ timeout: 5000 }).then(() => true, () => false);
  await page.keyboard.press("Escape");
  check(s1.active === true && status, `/play: active ${s1.active}, status line ${status ? 'reads "Piano: laptop sound"' : "missing"}`);
  await page.screenshot({ path: join(out, "results-1280x720.png") });

  // 3. watch-demo through the laptop: voices during the song, none at the end.
  await goto(page, "/");
  const twinkle = page.getByTestId("song-twinkle");
  await twinkle.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(300); // hydration
  await twinkle.focus();
  await page.keyboard.press("w");
  await page.waitForFunction(() => window.__pianoArcadeDemo?.on === true, null, { timeout: 60_000 });
  let most = 0;
  let sampled = 0;
  while (!(await page.getByTestId("results").isVisible().catch(() => false)) && sampled < 600) {
    most = Math.max(most, (await laptop(page)).voices ?? 0);
    sampled++;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000); // the last note's release
  const end = await laptop(page);
  check(most > 0 && end.voices === 0, `watch-demo on Twinkle: up to ${most} voices during the song, ${end.voices} at the end`);

  // 4. ?midi=off: silent.
  await goto(page, "/play?song=twinkle&midi=off");
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.down("a");
  const off = await laptop(page);
  await page.keyboard.up("a");
  check(off.active === false && off.voices === 0, `?midi=off: active ${off.active}, ${off.voices} voices on a key press`);
} catch (e) {
  check(false, `stopped: ${e.message}`);
}
check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
await browser.close();

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-laptop: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-laptop: pass (evidence: ${out})`);
process.exit(0);
