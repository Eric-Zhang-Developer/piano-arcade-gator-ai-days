// Headless proof of watch-demo (spec: watch-demo, Validation). Starts its own dev server; prints `verify-watch: pass`
// and exits 0, or names each failed step and exits 1:
// 1. On /, focus Twinkle and press W: the URL is song=twinkle&bot=perfect&audible=1&demo=1, the take starts with no
//    click, and __pianoArcadeDemo.on is true.
// 2. Mid-take the HUD shows DEMO (screenshot); the results reach 100%; localStorage's records are byte-for-byte as before.
// 3. "Back to songs" has the focus; within 10 s of the results the URL is /.
// 4. Meta+W on / doesn't navigate. (No WATCH link: #599 took it out of the preview's row, which it overflowed.)
// 5. Screenshots of the DEMO badge and the results panel at 1280×720 and 1920×1080, and the results with reduced motion.
// Usage: node web/src/game/watch-demo/verify-watch.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-watch.mjs --out <dir>");
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
say(`verify-watch: starting next dev on ${port}`);
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

const RECORDS = "pianoArcade.records";
const WANT = "song=twinkle&bot=perfect&audible=1&demo=1";
const browser = await chromium.launch({ headless: true });
const errors = [];
for (const [w, h, reducedMotion] of [
  [1280, 720],
  [1920, 1080],
  [1920, 1080, "reduce"],
]) {
  const size = `${w}x${h}${reducedMotion ? "-reduced" : ""}`;
  const first = w === 1280; // every check once; the other runs for screenshots
  const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await goto(page, "/");
  const twinkle = page.getByTestId("song-twinkle");
  await twinkle.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(300); // hydration
  // A record on file first, so "unchanged" compares real bytes; the demo must not add to it or rewrite it.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ "twinkle:normal": { best: null, top: [] }, seededBy: "verify-watch" })), RECORDS);
  const before = await page.evaluate((k) => localStorage.getItem(k), RECORDS);
  if (first) {
    // 4. Meta+W doesn't navigate.
    await twinkle.focus();
    await page.keyboard.press("Meta+w");
    await page.waitForTimeout(500);
    check(new URL(page.url()).pathname === "/", `Meta+W stays on ${new URL(page.url()).pathname}`);
  }

  // 1. W opens the demo, which starts itself.
  await twinkle.focus();
  await page.keyboard.press("w");
  await page.waitForURL(/\/play\?/, { timeout: 60_000 });
  const query = new URL(page.url()).search.slice(1);
  const started = await page
    .waitForFunction(() => window.__pianoArcadeDemo?.on === true && !document.querySelector("main button"), null, { timeout: 60_000 })
    .then(() => true, () => false);
  if (first) {
    check(query === WANT, `W opens /play?${query}`);
    check(started, "the take starts with no click, and __pianoArcadeDemo.on is true");
  }

  // 2. DEMO in the HUD mid-take, then the results.
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(out, `demo-${size}.png`) });
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  const resultsAt = Date.now();
  await page.waitForTimeout(600); // the panel's focus effect
  await page.screenshot({ path: join(out, `results-${size}.png`) });
  const accuracy = (await page.getByTestId("accuracy").textContent().catch(() => ""))?.trim();
  const after = await page.evaluate((k) => localStorage.getItem(k), RECORDS);
  const focus = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  if (first) {
    check(/^100(\.0+)?%$/.test(accuracy ?? ""), `results accuracy ${accuracy}`);
    check(after === before, `records unchanged (${before === null ? "none" : `${before.length} bytes`} before, ${after === null ? "none" : `${after.length} bytes`} after)`);
    // 3. Focus, then back to /.
    check(focus === "Back to songs", `"${focus}" has the focus`);
    const home = await page.waitForURL((u) => u.pathname === "/", { timeout: 10_000 }).then(() => (Date.now() - resultsAt) / 1000, () => null);
    check(home !== null, `back on / ${home === null ? "not within 10 s" : `${home.toFixed(1)} s after the results`}`);
  }
  await context.close();
}
await browser.close();
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-watch: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-watch: pass (evidence: ${out})`);
process.exit(0);
