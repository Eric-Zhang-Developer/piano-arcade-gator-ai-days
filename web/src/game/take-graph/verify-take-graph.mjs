// Headless proof of the take graph, the spec's Chrome steps: /play?bot=sloppy shows dots above and below zero and
// ×s for the misses, a dot names its bar, beat, offset and judgment, and /play?bot=late puts every dot about 40 ms
// late. Also: the table lists one row per note. Screenshots of each. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/take-graph/verify-take-graph.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-take-graph.mjs --out <dir>");
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
say(`verify-take-graph: starting next dev on ${port}`);
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

// "Bar 5, beat 2 · +32 ms · GREAT · velocity 74" -> its signed offset, or null for a MISS.
const offsetOf = (label) => {
  const m = /· ([+−±])(\d+) ms/.exec(label);
  return m ? (m[1] === "−" ? -1 : 1) * Number(m[2]) : null;
};

async function takeWith(browser, bot) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/play?song=twinkle&bot=${bot}&beat=off`);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 });
  await page.waitForSelector('[data-testid="take-graph"]', { timeout: 90_000 });
  const graph = page.getByTestId("take-graph");
  await graph.scrollIntoViewIfNeeded();
  const labels = await graph.locator('svg g[role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  return { page, graph, labels, errors };
}

const browser = await chromium.launch({ headless: true });
let failed = false;
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
  const fail = [];

  const sloppy = await takeWith(browser, "sloppy");
  const offs = sloppy.labels.map(offsetOf);
  const misses = sloppy.labels.filter((l) => l.endsWith("· MISS")).length;
  if (sloppy.labels.length !== 42) fail.push(`sloppy: ${sloppy.labels.length} dots, want 42`);
  if (!offs.some((o) => o > 0) || !offs.some((o) => o < 0)) fail.push(`sloppy: dots not on both sides of zero`);
  if (!misses) fail.push("sloppy: no MISS ×");
  await sloppy.graph.screenshot({ path: join(out, "sloppy.png") });
  await sloppy.page.screenshot({ path: join(out, "sloppy-results-1280x720.png"), fullPage: true });
  const width = await sloppy.graph.evaluate((el) => el.getBoundingClientRect().width);
  const height = await sloppy.graph.evaluate((el) => el.getBoundingClientRect().height);
  if (width < 880) fail.push(`graph is ${width} px wide at 1280×720, want 900`);
  if (height > 240) fail.push(`graph is ${height} px tall, over results-layout's 240 px`);
  const clip = await sloppy.page.getByTestId("results").evaluate((el) => Math.round(el.getBoundingClientRect().top));
  say(`verify-take-graph: panel ${Math.round(width)}×${Math.round(height)} px; results screen top at ${clip} px`);
  const dot = sloppy.graph.locator('svg g[role="img"]').first();
  await dot.hover();
  const title = await dot.locator("title").textContent();
  if (!/^Bar \d+, beat [\d.]+ · /.test(title)) fail.push(`hover title: ${title}`);
  await sloppy.page.getByRole("button", { name: "Show as table" }).click();
  const rows = await sloppy.page.getByTestId("take-graph-table").locator("tbody tr").count();
  if (rows !== 42) fail.push(`table: ${rows} rows, want 42`);
  await sloppy.graph.screenshot({ path: join(out, "sloppy-table.png") });
  fail.push(...sloppy.errors);

  const late = await takeWith(browser, "late");
  const lateOffs = late.labels.map(offsetOf);
  const off = lateOffs.filter((o) => o === null || o < 30 || o > 55);
  if (off.length) fail.push(`late: ${off.length} dots outside +30..+55 ms: ${JSON.stringify(off.slice(0, 5))}`);
  await late.graph.screenshot({ path: join(out, "late.png") });
  fail.push(...late.errors);

  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-take-graph: pass, sloppy ${misses} MISS and dots both sides of zero, hover "${title}", table 42 rows, late all +${Math.min(...lateOffs)}..+${Math.max(...lateOffs)} ms (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-take-graph: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
