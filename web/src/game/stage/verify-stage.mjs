// Headless proof of the fever stage: the Perfect player plays Twinkle with the stage on and with ?stage=off, and
// both takes must be all PERFECT. With the stage on there must be one WebGL canvas behind the highway; with it off,
// none. Screenshots mid-song of each. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/stage/verify-stage.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-stage.mjs --out <dir>");
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
const base = `http://localhost:${port}/play?input=test&beat=off`;
say(`verify-stage: starting next dev on ${port}`);
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

async function take(browser, name, url, wantStage) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const logs = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.text().startsWith("fever-stage") && logs.push(m.text()));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  await page.waitForTimeout(8000); // past the count-in, a few notes in
  await page.screenshot({ path: join(out, `${name}-mid-song.png`) });
  const stageCanvases = await page.evaluate(() => document.querySelectorAll("main > div canvas").length);
  await page.waitForSelector('[data-testid="results"]', { timeout: 60_000 });
  const results = await page.evaluate(() => window.__pianoArcade.results);
  await page.close();

  const fail = [...errors];
  if (results.counts.PERFECT !== chart.notes.length) fail.push(`${name}: ${JSON.stringify(results.counts)}, not all PERFECT`);
  if (stageCanvases !== (wantStage ? 1 : 0)) fail.push(`${name}: ${stageCanvases} stage canvases, want ${wantStage ? 1 : 0}`);
  return { name, counts: results.counts, notes: chart.notes.length, stageCanvases, logs, fail };
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
  const runs = [await take(browser, "stage-on", base, true), await take(browser, "stage-off", `${base}&stage=off`, false)];
  writeFileSync(join(out, "stage.json"), JSON.stringify(runs, null, 2));
  for (const r of runs) {
    say(`verify-stage: ${r.name}: ${r.counts.PERFECT}/${r.notes} PERFECT, ${r.stageCanvases} stage canvas${r.logs.length ? `; ${r.logs.join("; ")}` : ""}`);
  }
  const fail = runs.flatMap((r) => r.fail);
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-stage: pass, all PERFECT with the stage on and with ?stage=off (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-stage: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
