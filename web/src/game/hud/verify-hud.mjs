// Headless proof of the HUD: play Twinkle with one missed note and one extra key, screenshot the HUD mid-song just
// after the combo-25 milestone, and fail unless the HUD's numbers match the results screen and a score recomputed
// here from the judgments. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/hud/verify-hud.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-hud.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const MISSED = 2; // index of the note nobody plays

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const url = `http://localhost:${port}/play?input=test&beat=off`;
say(`verify-hud: starting next dev on ${port}`);
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

// The spec's rule, written again here so the check doesn't trust the code it checks.
function expectedScore(judgments) {
  let combo = 0;
  let score = 0;
  for (const j of judgments) {
    if (j.judgment === "MISS") {
      combo = 0;
      continue;
    }
    const mult = combo >= 30 ? 4 : combo >= 20 ? 3 : combo >= 10 ? 2 : 1;
    score += (j.judgment === "PERFECT" ? 100 : 50) * mult;
    combo++;
  }
  return { score, combo };
}

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
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(
    ([notes, mpb, missed]) => {
      // Alternate PERFECT (+5 ms) and GREAT (+35 ms); skip one note; one extra key, far from any note.
      notes.forEach((n, i) => i !== missed && window.__pianoArcade.press(n.pitch, n.beat * mpb + (i % 2 ? 35 : 5)));
      window.__pianoArcade.press(30, 1.5 * mpb);
    },
    [chart.notes, mpb, MISSED],
  );

  await page.waitForFunction(() => (window.__pianoArcadeHud?.combo ?? 0) >= 25, null, { timeout: 60_000 });
  await page.waitForTimeout(150); // inside the swell, with the ghost still showing
  await page.screenshot({ path: join(out, "hud-mid-song.png") });
  const mid = await page.evaluate(() => window.__pianoArcadeHud);
  say(`verify-hud: mid-song combo ${mid.combo}, score ${mid.score}, milestone ${mid.milestone?.count}`);

  await page.waitForSelector('[data-testid="results"]', { timeout: 60_000 });
  const results = await page.evaluate(() => window.__pianoArcade.results);
  const hud = await page.evaluate(() => window.__pianoArcadeHud);
  await page.screenshot({ path: join(out, "results.png") });

  // Judgments in chart order are time order for Twinkle (one note at a time).
  const exp = expectedScore(results.judgments);
  const fail = [];
  for (const k of ["PERFECT", "GREAT", "MISS", "extra"]) if (hud[k] !== results.counts[k]) fail.push(`${k}: HUD ${hud[k]}, results ${results.counts[k]}`);
  if (results.counts.MISS !== 1 || results.counts.extra !== 1) fail.push(`take didn't go as scripted: ${JSON.stringify(results.counts)}`);
  if (hud.score !== exp.score) fail.push(`score: HUD ${hud.score}, expected ${exp.score}`);
  if (hud.combo !== exp.combo) fail.push(`combo: HUD ${hud.combo}, expected ${exp.combo}`);
  if (mid.milestone?.count !== 25) fail.push(`milestone: ${JSON.stringify(mid.milestone)}`);
  if (errors.length) fail.push(...errors);
  writeFileSync(join(out, "hud.json"), JSON.stringify({ mid, hud, counts: results.counts, expected: exp }, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-hud: pass, HUD ${JSON.stringify({ ...results.counts, score: hud.score, combo: hud.combo })} (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-hud: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
