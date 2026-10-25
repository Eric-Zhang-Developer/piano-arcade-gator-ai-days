// Headless proof of sheet-pickups (spec: Validation). Starts its own dev server.
// For each library chart, /sheet?song=<id>: the page hook's firstMeasure is { number: 0, beats: <pickup> } for the
// four songs whose sources open with \partial, and { number: 1, beats: beatsPerBar } for the rest. A shot of each of
// the four's first system.
// Usage: node web/src/game/sheet-pickups/verify-pickups.mjs --out <dir>
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// The spec's lengths, in beats, read from the charts' first notes at 2e18582; not computed by the code under test.
const PICKUPS = { "chopin-prelude-4": 1, "fur-elise": 0.5, "maple-leaf-rag": 0.5, "nocturne-op9-2": 0.5 };

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-pickups.mjs --out <dir>");
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
say(`verify-pickups: starting next dev on ${port}`);
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

const browser = await chromium.launch({ headless: true });
const fail = [];
const results = {};
try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(`${base}/sheet`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const songsDir = join(webDir, "public/songs");
  const ids = readdirSync(songsDir).filter((d) => existsSync(join(songsDir, d, "chart.json"))).sort();
  for (const id of ids) {
    const { beatsPerBar } = JSON.parse(readFileSync(join(songsDir, id, "chart.json"), "utf8"));
    const want = PICKUPS[id] ? { number: 0, beats: PICKUPS[id] } : { number: 1, beats: beatsPerBar };
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${base}/sheet?song=${id}`);
    await page.locator('main[data-sheet="ready"]').waitFor({ timeout: 90_000 });
    const got = await page.evaluate(() => window.__pianoArcadeSheet?.firstMeasure ?? null);
    results[id] = got;
    const ok = got?.number === want.number && Math.abs(got.beats - want.beats) < 1e-6;
    say(`${ok ? "ok  " : "FAIL"} ${id}: firstMeasure ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    if (!ok) fail.push(id);
    if (PICKUPS[id]) await page.screenshot({ path: join(out, `${id}-first-system.png`) });
    await page.close();
  }
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
writeFileSync(join(out, "results.json"), JSON.stringify({ results, fail }, null, 2));
if (fail.length) {
  say(`verify-pickups: FAIL ${fail.join(", ")} (evidence: ${out})`);
  process.exit(1);
}
say(`verify-pickups: pass (evidence: ${out})`);
process.exit(0);
