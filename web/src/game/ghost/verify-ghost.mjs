// Headless proof of the ghost on Twinkle: a take played 60 ms late, then Retry and two takes all PERFECT. The second
// take shows the late take's ghost (one outline per note, screenshot: outlines trail the notes), the third shows
// the second's (aligned). With ?ghost=off, Retry shows none. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/ghost/verify-ghost.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-ghost.mjs --out <dir>");
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
const base = `http://localhost:${port}/play?song=twinkle&input=test&beat=off`;
say(`verify-ghost: starting next dev on ${port}`);
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

// One take: every note at `offsetMs`, then the results. Returns the results' counts and the ghost shown at its start.
async function take(page, offsetMs, shot) {
  await page.waitForFunction(() => window.__pianoArcade?.ready === true && window.__pianoArcade.results === null, null, { timeout: 60_000 });
  const shown = await page.evaluate(() => window.__pianoArcadeGhost);
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb, o]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb + o)), [chart.notes, mpb, offsetMs]);
  if (shot) {
    await page.waitForTimeout(6300); // count-in done, notes and ghosts falling
    await page.screenshot({ path: join(out, shot) });
  }
  await page.waitForFunction(() => window.__pianoArcade.results !== null, null, { timeout: 90_000 });
  const counts = await page.evaluate(() => window.__pianoArcade.results.counts);
  return { counts, shown, notes: chart.notes.length };
}
const retry = (page) => page.getByRole("button", { name: "Retry" }).click();

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(base);
  const late = await take(page, 60); // GREAT: 40 ms is PERFECT since judging-tiers (#859)
  if (late.shown?.hits !== 0) fail.push(`first take showed a ghost: ${JSON.stringify(late.shown)}`);
  if (late.counts.GREAT !== late.notes) fail.push(`late take: ${JSON.stringify(late.counts)}`);
  await retry(page);
  const second = await take(page, 0, "ghost-after-late-take.png");
  await retry(page);
  const third = await take(page, 0, "ghost-after-perfect-take.png");
  for (const [name, t] of [["second", second], ["third", third]]) {
    if (t.counts.PERFECT !== t.notes || t.counts.MISS !== 0) fail.push(`${name} take not all PERFECT: ${JSON.stringify(t.counts)}`);
    if (t.shown?.hits !== t.notes || !t.shown.on) fail.push(`${name} take's ghost: ${JSON.stringify(t.shown)}, want ${t.notes} hits`);
  }
  fail.push(...errors);

  const offPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await offPage.goto(`${base}&ghost=off`);
  await take(offPage, 0);
  await retry(offPage);
  const off = await take(offPage, 0, "ghost-off.png");
  if (off.shown?.on !== false) fail.push(`?ghost=off: ${JSON.stringify(off.shown)}`);

  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-ghost: pass, Retry after a +60 ms take showed ${second.shown.hits} outlines; two takes in a row all PERFECT (${second.notes}/${second.notes}); ?ghost=off drew none (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-ghost: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
