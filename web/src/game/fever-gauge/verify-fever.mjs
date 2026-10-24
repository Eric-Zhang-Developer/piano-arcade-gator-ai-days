// Headless proof of the fever gauge on Twinkle: play every note PERFECT except one during fever. Fever must start
// on the 12th hit, end at the miss, and start again once the gauge refills; the meter and the judge must agree.
// Screenshots of fever on and off. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/fever-gauge/verify-fever.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-fever.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const MISSED = 20; // index of the note nobody plays: fever is on by then

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const url = `http://localhost:${port}/play?input=test&beat=off`;
say(`verify-fever: starting next dev on ${port}`);
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
let failed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  // Count every fever edge the judge sends, and the meter's state at each one.
  await page.evaluate(() => {
    window.__feverLog = [];
    let was = false;
    setInterval(() => {
      const g = window.__pianoArcadeFeverGauge;
      if (g && g.fever !== was) window.__feverLog.push({ fever: g.fever, hud: window.__pianoArcadeHud?.combo ?? null });
      was = g?.fever ?? false;
    }, 5);
  });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(
    ([notes, mpb, missed]) => notes.forEach((n, i) => i !== missed && window.__pianoArcade.press(n.pitch, n.beat * mpb + 5)),
    [chart.notes, mpb, MISSED],
  );

  await page.waitForFunction(() => window.__pianoArcadeFeverGauge?.fever === true, null, { timeout: 60_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "fever-on.png") });
  await page.waitForFunction(() => window.__pianoArcadeFeverGauge?.fever === false, null, { timeout: 60_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "fever-off-after-miss.png") });

  await page.waitForSelector('[data-testid="results"]', { timeout: 60_000 });
  const results = await page.evaluate(() => window.__pianoArcade.results);
  const log = await page.evaluate(() => window.__feverLog);
  const gauge = await page.evaluate(() => window.__pianoArcadeFeverGauge);
  const fail = [];
  if (gauge.size !== 12) fail.push(`gauge size ${gauge.size}, want 12 for Twinkle`);
  if (results.counts.MISS !== 1 || results.counts.PERFECT !== chart.notes.length - 1) fail.push(`take didn't go as scripted: ${JSON.stringify(results.counts)}`);
  // Fever on at combo 12, off at the miss, on again 12 hits later (once per fill).
  const edges = log.map((e) => e.fever);
  if (JSON.stringify(edges) !== JSON.stringify([true, false, true])) fail.push(`fever edges ${JSON.stringify(log)}`);
  if (log[0]?.hud !== 12) fail.push(`fever started at combo ${log[0]?.hud}, want 12`);
  if (errors.length) fail.push(...errors);
  writeFileSync(join(out, "fever.json"), JSON.stringify({ log, gauge, counts: results.counts }, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-fever: pass, fever on at combo 12, off at the miss, on again after a refill (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-fever: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
