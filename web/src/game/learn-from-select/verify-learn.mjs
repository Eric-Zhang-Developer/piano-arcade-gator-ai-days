// Headless proof of learn-from-select (spec: learn-from-select, Validation): on /, L opens the focused song in wait mode,
// LEARN does the same, Enter still opens a judged take, and Ctrl+L / Meta+L leave the page alone. Screenshots of / at
// 1280×720 and 1920×1080. Prints "verify-learn: pass" and exits 0, or names each failed step and exits 1.
// Usage: node web/src/game/learn-from-select/verify-learn.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-learn.mjs --out <dir>");
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
say(`verify-learn: starting next dev on ${port}`);
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
const search = (page) => new URL(page.url()).search;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// / with the first card focused, as it loads.
async function home() {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.locator("ol a").first().waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.activeElement?.matches("ol a"), null, { timeout: 10_000 });
}
await home();
const ids = await page.locator("ol a").evaluateAll((as) => as.map((a) => new URL(a.href).searchParams.get("song")));
const hint = await page.getByText("choose ·").textContent();
check(hint === "↑ ↓ choose · Enter play · L learn", `the hint reads "${hint}"`);

// 1. ↓ then L: the second song in wait mode.
await page.keyboard.press("ArrowDown");
await page.keyboard.press("l");
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(search(page) === `?song=${ids[1]}&mode=wait`, `↓ then L opens ${search(page)} (want ?song=${ids[1]}&mode=wait)`);
const line = page.getByText("Wait mode: the song waits for each note");
await line.waitFor({ timeout: 30_000 }).catch(() => {});
check(await line.isVisible(), "… and wait mode's start line shows");

// 2. LEARN on the focused song.
await home();
await page.getByTestId("preview-learn").click();
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(search(page) === `?song=${ids[0]}&mode=wait`, `LEARN opens ${search(page)} (want ?song=${ids[0]}&mode=wait)`);

// 3. Enter is unchanged: a judged take.
await home();
await page.keyboard.press("Enter");
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(search(page) === `?song=${ids[0]}`, `Enter opens ${search(page)}, judged (want ?song=${ids[0]})`);

// 4. Ctrl+L / Meta+L are the browser's.
await home();
await page.keyboard.press(process.platform === "darwin" ? "Meta+L" : "Control+L");
await page.waitForTimeout(1500);
check(new URL(page.url()).pathname === "/" && search(page) === "", `${process.platform === "darwin" ? "Meta" : "Ctrl"}+L leaves the page on ${page.url()}`);

// 5. Screenshots of / with the hint and LEARN.
for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  await page.setViewportSize({ width: w, height: h });
  await home();
  await page.getByTestId("preview-learn").waitFor();
  await page.screenshot({ path: join(out, `select-${w}x${h}.png`) });
}
say(`verify-learn: screenshots in ${out}`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-learn.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-learn: ${failures.length} failed` : "verify-learn: pass");
process.exit(failures.length ? 1 : 0);
