// Headless proof of crash-guard (spec: crash-guard). Starts its own dev server; prints `verify-crash: pass` and exits 0,
// or names each failed step and exits 1:
// 1. /play?song=twinkle&bot=perfect&crash=draw -> one "crash-guard's draw threw" line, the toast shown then gone by
//    5 s, results with 42 PERFECT. Toast screenshots at 1280×720 and 1920×1080.
// 2. The same with crash=event -> one "onEvent threw" line, 42 PERFECT.
// 3. /?crash=render and /play?crash=render -> the card; Enter on its focused button -> / with no card. Card
//    screenshots at both sizes, and with reduced motion.
// 4. #286's case: /play?song=twinkle&input=test, a press at pitch 30 -> results.
// Usage: node web/src/game/crash-guard/verify-crash.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-crash.mjs --out <dir>");
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
say(`verify-crash: starting next dev on ${port}`);
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

const N = 42; // Twinkle's notes
const errors = [];
const watch = (page) => {
  const lines = [];
  page.on("console", (m) => m.type() === "error" && m.text().startsWith("crash-guard:") && lines.push(m.text()));
  page.on("pageerror", (e) => /test crash/.test(e.message) || errors.push(e.message));
  return lines;
};
const perfect = async (page) => ((await page.getByTestId("count-PERFECT").count()) ? Number(await page.getByTestId("count-PERFECT").textContent()) : null);
const toastText = "crash-guard stopped after an error. The game goes on.";

async function crashTake(browser, crash, [w, h], first) {
  const size = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const lines = watch(page);
  await goto(page, `/play?song=twinkle&bot=perfect&crash=${crash}`);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves
  const toast = page.getByTestId("toast").filter({ hasText: toastText });
  const shown = await toast.first().waitFor({ timeout: 30_000 }).then(() => Date.now(), () => null);
  if (crash === "draw") await page.screenshot({ path: join(out, `toast-${size}.png`) });
  const gone = shown && (await toast.first().waitFor({ state: "detached", timeout: 5000 }).then(() => (Date.now() - shown) / 1000, () => null));
  await page.getByTestId("results").waitFor({ timeout: 120_000 }).catch(() => {});
  const p = await perfect(page);
  const hook = crash === "draw" ? "draw" : "onEvent";
  const mine = lines.filter((l) => l.startsWith(`crash-guard: crash-guard's ${hook} threw`));
  if (first || crash === "draw") {
    check(mine.length === 1 && lines.length === 1, `${crash} ${size}: one "${hook} threw" line (${lines.length}: ${lines.join(" | ")})`);
    check(shown !== null, `${crash} ${size}: the toast reads "${toastText}"`);
    check(gone !== null, `${crash} ${size}: the toast is gone by 5 s${gone ? ` (${gone.toFixed(1)} s)` : ""}`);
    check(p === N, `${crash} ${size}: results with ${p}/${N} PERFECT`);
  }
  await page.close();
}

async function card(browser, path, [w, h], reducedMotion) {
  const size = `${w}x${h}`;
  const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion });
  const page = await context.newPage();
  watch(page);
  await goto(page, path);
  const shown = await page.getByTestId("crash-card").waitFor({ timeout: 60_000 }).then(() => true, () => false);
  const name = path.startsWith("/play") ? "play" : "home";
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `card-${name}-${size}${reducedMotion === "reduce" ? "-reduced" : ""}.png`) });
  const focus = await page.evaluate(() => document.activeElement?.textContent ?? "");
  await page.keyboard.press("Enter");
  await page.waitForURL(`${base}/`, { timeout: 30_000 }).catch(() => {});
  await page.locator('ol a[data-testid^="song-"]').first().waitFor({ timeout: 60_000 }).catch(() => {});
  const after = { url: page.url(), card: await page.getByTestId("crash-card").count() };
  check(shown, `${path} ${size}: the card shows`);
  check(focus === "Back to the song list", `${path} ${size}: "${focus}" has the focus`);
  check(after.url === `${base}/` && after.card === 0, `${path} ${size}: Enter -> ${after.url.replace(base, "")} with ${after.card} card(s)`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
const sizes = [
  [1280, 720],
  [1920, 1080],
];
// 1 and 2. A plugin's throw, mid-take.
for (const [i, size] of sizes.entries()) await crashTake(browser, "draw", size, i === 0);
await crashTake(browser, "event", sizes[0], true);
// 3. A render error.
for (const size of sizes) for (const path of ["/?crash=render", "/play?crash=render"]) await card(browser, path, size);
await card(browser, "/play?crash=render", sizes[1], "reduce");
// 4. #286: a key outside the chart's range.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  watch(page);
  await goto(page, "/play?song=twinkle&input=test");
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => window.__pianoArcade.press(30, 1000));
  const done = await page.getByTestId("results").waitFor({ timeout: 120_000 }).then(() => true, () => false);
  check(done, "#286: a press at pitch 30 -> results");
  await page.close();
}
await browser.close();
check(errors.length === 0, `no page errors besides the test crashes${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-crash: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-crash: pass (evidence: ${out})`);
process.exit(0);
