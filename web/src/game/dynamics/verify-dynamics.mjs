// Headless proof of the dynamics panel (spec: dynamics, Validation): the Perfect player plays Chopin's Prelude (its
// velocities come from the score's CC7 dynamics) through window.__pianoArcade.press with ?input=test. At the chart's own
// velocities every phrase must be ok; with the loudest-marked phrase played at velocity 30, that phrase must be too soft.
// Usage: node web/src/game/dynamics/verify-dynamics.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-dynamics.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const SOFT = 30;

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const url = `http://localhost:${port}/play?song=chopin-prelude-4&input=test&beat=off&stage=off`;
say(`verify-dynamics: starting next dev on ${port}`);
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

// soften: the phrase index (2 bars each, from bar 1) to play at SOFT, or null to play every note at its own velocity.
async function take(browser, name, soften) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  const phraseOf = (n) => Math.floor(Math.floor(n.beat / chart.beatsPerBar) / 2);
  await page.evaluate(
    (notes) => notes.forEach(([pitch, t, v]) => window.__pianoArcade.press(pitch, t, v)),
    chart.notes.map((n) => [n.pitch, n.beat * mpb, phraseOf(n) === soften ? SOFT : n.velocity]),
  );
  const lastBeat = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  await page.waitForSelector('[data-testid="slot-dynamics"]', { timeout: lastBeat * mpb + 60_000 });
  const panel = page.getByTestId("slot-dynamics");
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: join(out, `${name}.png`) });
  const text = await panel.innerText();
  const results = await page.evaluate(() => window.__pianoArcade.results);
  await page.close();
  return { name, text, counts: results.counts, notes: chart.notes.length, errors, phraseOf, chart };
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
  const fail = [];
  const own = await take(browser, "own-velocities", null);
  say(`verify-dynamics: own velocities -> ${own.text.split("\n")[0]}`);
  if (own.counts.PERFECT !== own.notes) fail.push(`own: ${JSON.stringify(own.counts)}, not all PERFECT`);
  if (!/All \d+ graded phrases match the score/.test(own.text)) fail.push(`own: panel says "${own.text.split("\n")[0]}"`);

  // The loudest-marked phrase, played soft.
  const means = new Map();
  for (const n of own.chart.notes) means.set(own.phraseOf(n), [...(means.get(own.phraseOf(n)) ?? []), n.velocity]);
  const [loudest] = [...means].map(([p, v]) => [p, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => b[1] - a[1])[0];
  const from = loudest * 2 + 1;
  const soft = await take(browser, "one-phrase-soft", loudest);
  say(`verify-dynamics: bars ${from}–${from + 1} at velocity ${SOFT} -> ${soft.text.split("\n")[0]}`);
  if (!new RegExp(`Bars ${from}–${from + 1}: too soft`).test(soft.text)) fail.push(`soft: bars ${from}–${from + 1} not flagged too soft`);
  if (/too loud/.test(soft.text) || (soft.text.match(/too soft,/g) ?? []).length !== 1) fail.push("soft: other phrases flagged too");
  fail.push(...own.errors, ...soft.errors);
  writeFileSync(join(out, "dynamics.json"), JSON.stringify({ own: own.text, soft: soft.text }, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-dynamics: pass (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-dynamics: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
