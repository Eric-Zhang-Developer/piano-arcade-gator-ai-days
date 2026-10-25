// Headless proof of sheet review (spec: sheet-review, Validation). Its own `next dev`:
// 1. bot=rank-c's results, "Review on sheet ↗" -> a popup on /sheet?song=twinkle&review=1, ready, with review true, no
//    cursor, and its colored noteheads equal to the results' PERFECT, GREAT, GOOD and MISS counts (MISS above 0).
// 2. Retry as bot=perfect, click again -> the same window now shows MISS 0: the review is this take's, not a stale one.
// 3. Under ?capture=1 the button isn't visible.
// 4. Screenshots of the actions row and the review at 1280×720 and 1920×1080.
// Bots play without ?input=test, which swaps in the test input device. ?beat=off keeps the laptop click out.
// Usage: node web/src/game/sheet-review/verify-review.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-review.mjs --out <dir>");
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
say(`verify-review: starting next dev on ${port}`);
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
for (let i = 0; ; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 240) throw new Error("server not ready after 120 s");
  await new Promise((r) => setTimeout(r, 500));
}

const failures = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};
const JUDGMENTS = ["PERFECT", "GREAT", "GOOD", "MISS"];
const playUrl = (bot, extra = "") => `${base}/play?song=twinkle&beat=off&bot=${bot}${extra}`;

// A take to its results, settled; then the results' counts.
async function take(page, url) {
  await page.goto(url);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 90_000 });
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(2500); // the tally counts up
  return page.evaluate(
    (js) => Object.fromEntries(js.map((j) => [j, Number(document.querySelector(`[data-testid="count-${j}"]`)?.textContent)])),
    JUDGMENTS,
  );
}
// The sheet window, once its score is drawn and painted.
async function sheet(popup) {
  await popup.waitForURL(/\/sheet\?song=twinkle&review=1$/, { timeout: 30_000 });
  await popup.locator('[data-sheet="ready"]').waitFor({ timeout: 90_000 });
  await popup.waitForFunction(() => window.__pianoArcadeSheet?.review !== undefined, null, { timeout: 30_000 });
  await popup.waitForTimeout(500);
  return popup.evaluate(() => {
    const { review, cursorMs, colored } = window.__pianoArcadeSheet;
    return { review, cursorMs, colored };
  });
}
const same = (a, b) => JUDGMENTS.every((j) => a[j] === b[j]);
const show = (c) => JUDGMENTS.map((j) => `${j} ${c[j]}`).join(", ");

const browser = await chromium.launch();
const errors = [];
for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  const tag = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag} /play: ${e.message}`));
  try {
    // 1
    const counts = await take(page, playUrl("rank-c"));
    await page.locator('[class*="actions"]').first().screenshot({ path: join(out, `actions-${tag}.png`) });
    const [popup] = await Promise.all([ctx.waitForEvent("page", { timeout: 30_000 }), page.getByTestId("sheet-review").click()]);
    popup.on("pageerror", (e) => errors.push(`${tag} /sheet: ${e.message}`));
    await popup.setViewportSize({ width: w, height: h });
    const first = await sheet(popup);
    check(first.review === true && first.cursorMs === null, `${tag} 1: the popup is a review with no cursor (review ${first.review}, cursorMs ${first.cursorMs})`);
    check(same(first.colored, counts) && counts.MISS > 0, `${tag} 1: colored ${show(first.colored)} = the results' ${show(counts)}, MISS above 0`);
    await popup.screenshot({ path: join(out, `review-${tag}.png`) });
    // 2: the same window, reused by name
    const perfect = await take(page, playUrl("perfect"));
    await popup.evaluate(() => (window.__staleReview = true)); // the same URL reloads: wait for a new document
    await page.getByTestId("sheet-review").click();
    await popup.waitForFunction(() => !window.__staleReview, null, { timeout: 30_000 });
    const second = await sheet(popup);
    check(ctx.pages().length === 2, `${tag} 2: the click reused the sheet window (${ctx.pages().length} pages)`);
    check(same(second.colored, perfect) && second.colored.MISS === 0, `${tag} 2: after a perfect take, colored ${show(second.colored)}, MISS 0`);
    await popup.close();
  } catch (e) {
    check(false, `${tag}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}

// 3
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
try {
  await take(page, playUrl("rank-c", "&capture=1"));
  check(!(await page.getByTestId("sheet-review").isVisible()), "3: under ?capture=1 the button isn't visible");
} catch (e) {
  check(false, `3: ${e.message.split("\n")[0]}`);
}
await browser.close();

check(errors.length === 0, errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
if (failures.length) {
  say(`verify-review: ${failures.length} failed`);
  process.exit(1);
}
say(`verify-review: pass (evidence: ${out})`);
process.exit(0);
