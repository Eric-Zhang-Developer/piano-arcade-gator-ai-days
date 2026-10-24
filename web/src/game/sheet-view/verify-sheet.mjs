// Headless proof of /sheet: every library chart renders its score with no error and at least one notehead.
// Usage: node web/src/game/sheet-view/verify-sheet.mjs --out <dir> --static
// (Following a live take, the run without --static, comes with sheet-view's second PR.)
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1] || !process.argv.includes("--static")) {
  console.error("usage: verify-sheet.mjs --out <dir> --static");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

const songsDir = join(webDir, "public/songs");
const ids = readdirSync(songsDir)
  .filter((d) => d !== "local" && existsSync(join(songsDir, d, "chart.json")))
  .sort();
const SHOTS = ["twinkle", "ode-to-joy", "minuet-g"];

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-sheet: starting next dev on ${port}`);
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
for (let end = Date.now() + 120_000; ; ) {
  if (Date.now() > end) throw new Error("server not ready after 120 s");
  if (await fetch(`${base}/sheet`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ headless: true });
const fail = [];
const results = {};
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${base}/sheet?song=${id}`);
    await page.locator('main[data-sheet="ready"], main[data-sheet="error"]').waitFor({ timeout: 60_000 });
    const state = await page.locator("main").getAttribute("data-sheet");
    const alert = await page.locator('main [role="alert"]').allTextContents();
    const heads = await page.locator("svg .vf-notehead").count();
    results[id] = { state, heads, alert, errors };
    if (state !== "ready" || alert.length) fail.push(`${id}: ${alert.join(" ") || state}`);
    if (!heads) fail.push(`${id}: no noteheads in the SVG`);
    if (errors.length) fail.push(`${id}: page errors: ${errors.join("; ")}`);
    if (SHOTS.includes(id)) await page.screenshot({ path: join(out, `${id}.png`) });
    say(`verify-sheet: ${id} ${state}, ${heads} noteheads`);
    await page.close();
  }
  // On a 1920 monitor the score opens larger (its default zoom follows the window).
  const big = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await big.goto(`${base}/sheet?song=ode-to-joy`);
  await big.locator('main[data-sheet="ready"]').waitFor({ timeout: 60_000 });
  await big.screenshot({ path: join(out, "ode-to-joy-1920.png") });
  await big.close();
  writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
if (fail.length) {
  say(`verify-sheet: FAIL\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
say(`verify-sheet: pass, ${ids.length} charts render with noteheads and no error (evidence: ${out})`);
process.exit(0);
