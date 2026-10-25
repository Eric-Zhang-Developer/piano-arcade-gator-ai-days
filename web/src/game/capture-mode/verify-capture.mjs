// Headless proof of capture mode (spec: capture-mode, Validation), on a production build: Playwright at 1920×1080 with
// video on, /?capture=1 for 3 s, then /play?song=twinkle&bot=perfect in the same tab (sessionStorage carries the
// flag), Start, through to the results. On the select, the start screen and the results: the cursor is none on body
// and on Start or Retry, and no rendered text has any of WORDS. The same run without the flag must find each word on
// one of the three screens, so the check can fail. Also keeps screenshots of / and /play's start screen at 1280×720,
// with and without the flag.
// Usage: node web/src/game/capture-mode/verify-capture.mjs --out <dir> [--no-build]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-capture.mjs --out <dir> [--no-build]");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
// The spec's five, plus song-preview's status line (#295), which the first run of this check turned up on /. "OPTIONS"
// is the drawer's button that replaced the Calibrate link on / (#385; Calibrate is now inside the closed drawer, #431),
// in capitals because innerText applies its text-transform. /play's "Laptop keys" line is gone (duo-start, #772: no key
// hints on the start screen), so it's no longer a word to hide. CONTROLS: the select's ? link (mouse-first), in place of
// song-preview's "Press any key for previews", which mouse-first removed.
const WORDS = ["MIDI:", "Latency", "Effects", "OPTIONS", "CONTROLS"];

if (!process.argv.includes("--no-build")) {
  say("verify-capture: next build");
  const b = spawnSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) {
    say("verify-capture: the build failed");
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
say(`verify-capture: next start on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["start", "--port", String(port)], {
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

// One screen's state: body's cursor, a button's cursor, and which setup words show in the rendered text.
const look = (page, button) =>
  page.evaluate((args) => {
    const [words, label] = args;
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === label);
    const text = document.body.innerText; // innerText leaves out display:none elements
    return {
      body: getComputedStyle(document.body).cursor,
      button: b ? getComputedStyle(b).cursor : null,
      words: words.filter((w) => text.includes(w)),
    };
  }, [WORDS, button]);

async function take(capture) {
  const name = capture ? "capture" : "plain";
  const dir = join(out, name);
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir, size: { width: 1920, height: 1080 } } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/${capture ? "?capture=1" : ""}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the server is still starting
    }
  }
  await page.locator("ol a").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  const screens = { select: await look(page, null) };
  await page.screenshot({ path: join(dir, "select.png") });
  await page.goto(`${base}/play?song=twinkle&bot=perfect`);
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  screens.start = await look(page, "Start");
  await page.screenshot({ path: join(dir, "start.png") });
  await start.click();
  await page.waitForTimeout(12_000);
  await page.screenshot({ path: join(dir, "mid-take.png") });
  await page.getByTestId("results").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2500); // the results ceremony
  screens.results = await look(page, "Retry");
  await page.screenshot({ path: join(dir, "results.png") });
  await context.close();
  const [video] = readdirSync(dir).filter((f) => f.endsWith(".webm"));
  if (video) renameSync(join(dir, video), join(dir, `${name}.webm`));
  return { screens, errors };
}

const browser = await chromium.launch({ headless: true });

const on = await take(true);
for (const [screen, s] of Object.entries(on.screens)) {
  check(s.body === "none", `capture, ${screen}: body's cursor is ${s.body}`);
  if (s.button !== null) check(s.button === "none", `capture, ${screen}: the button's cursor is ${s.button}`);
  check(s.words.length === 0, `capture, ${screen}: no setup text${s.words.length ? ` (found ${s.words.join(", ")})` : ""}`);
}
check(on.errors.length === 0, `capture: no page errors${on.errors.length ? `: ${on.errors.join("; ")}` : ""}`);

const off = await take(false);
const seen = new Set(Object.values(off.screens).flatMap((s) => s.words));
const missing = WORDS.filter((w) => !seen.has(w));
check(missing.length === 0, `without the flag, every word shows somewhere${missing.length ? ` (missing ${missing.join(", ")})` : ""}, so the check can fail`);
check(off.screens.select.body !== "none", `without the flag, the cursor is ${off.screens.select.body}`);

// The same two screens at 1280×720, both ways, for the PR.
for (const capture of [false, true]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const name = capture ? "capture" : "plain";
  await page.goto(`${base}/${capture ? "?capture=1" : "?capture=0"}`);
  await page.locator("ol a").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, name, "select-1280.png") });
  await page.goto(`${base}/play?song=twinkle`);
  await page.getByRole("button", { name: "Start", exact: true }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, name, "start-1280.png") });
  await page.close();
}

writeFileSync(join(out, "verify-capture.json"), JSON.stringify({ failures, on: on.screens, off: off.screens }, null, 2));
await browser.close();
say(`verify-capture: videos and screenshots in ${out}`);
say(failures.length ? `verify-capture: ${failures.length} failed` : "verify-capture: pass");
process.exit(failures.length ? 1 : 0);
