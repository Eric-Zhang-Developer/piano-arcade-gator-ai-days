// Headless proof of /sheet.
// --static: every library chart renders its score with no error and at least one notehead.
// Without it: /sheet and /play?input=test share one browser context, a take is played Perfect as e2e/verify.mjs plays
// it, and the sheet's cursor must rise while every note's notehead ends up painted PERFECT.
// Usage: node web/src/game/sheet-view/verify-sheet.mjs --out <dir> [--static] [--songs id,id]
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-sheet.mjs --out <dir> [--static] [--songs id,id]");
  process.exit(2);
}
const isStatic = process.argv.includes("--static");
const songsArg = process.argv.indexOf("--songs");
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

const songsDir = join(webDir, "public/songs");
const ids = readdirSync(songsDir)
  .filter((d) => d !== "local" && existsSync(join(songsDir, d, "chart.json")))
  .sort();
const SHOTS = ["twinkle", "ode-to-joy", "minuet-g"];
// Following: these must end with every note PERFECT on the sheet; the dense three must render and follow, and their
// counts are reported (reading them is rough, a Gap in the done note).
const EXACT = ["twinkle", "ode-to-joy", "minuet-g", "fur-elise"];
const DENSE = ["chopin-prelude-4", "nocturne-op9-2", "maple-leaf-rag"];
const follows = songsArg > 0 ? process.argv[songsArg + 1].split(",") : [...EXACT, ...DENSE];
const PERFECT_FILL = "#ffe27a"; // hudSettings.judgmentColors.PERFECT (--pa-gold)

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
async function staticRun() {
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
}

async function followRun() {
  for (const id of follows) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    const sheet = await context.newPage();
    sheet.on("pageerror", (e) => errors.push(`sheet: ${e.message}`));
    await sheet.goto(`${base}/sheet?song=${id}`);
    await sheet.locator('main[data-sheet="ready"]').waitFor({ timeout: 60_000 });
    const play = await context.newPage();
    play.on("pageerror", (e) => errors.push(`play: ${e.message}`));
    await play.goto(`${base}/play?song=${id}&input=test`);
    await play.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    const chart = await play.evaluate(() => window.__pianoArcade.chart);
    const mpb = 60000 / chart.bpm;
    await play.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
    const lastBeat = Math.max(...chart.notes.map((n) => n.beat + n.duration));
    say(`verify-sheet: ${id} queued ${chart.notes.length} notes, ~${Math.round((lastBeat * mpb) / 1000)} s`);

    // The cursor, sampled once a second until the results screen.
    const cursor = [];
    const results = play.locator('[data-testid="results"]');
    for (let end = Date.now() + lastBeat * mpb + 30_000; !(await results.isVisible()); ) {
      if (Date.now() > end) throw new Error(`${id}: no results screen`);
      cursor.push(await sheet.evaluate(() => window.__pianoArcadeSheet?.cursorMs ?? null));
      await play.waitForTimeout(1000);
    }
    await sheet.waitForTimeout(500); // the last judgments cross the channel
    const hook = await sheet.evaluate(() => window.__pianoArcadeSheet);
    const svgPerfect = await sheet.evaluate(
      (c) => [...document.querySelectorAll(".vf-notehead path")].filter((p) => p.getAttribute("fill")?.toLowerCase() === c).length,
      PERFECT_FILL,
    );
    const game = await play.evaluate(() => window.__pianoArcade.results?.counts);
    if (EXACT.includes(id)) await sheet.screenshot({ path: join(out, `${id}-followed.png`) });
    await context.close();

    const n = chart.notes.length;
    const seen = cursor.filter((c) => c !== null);
    const rises = seen.length >= 2 && seen.at(-1) > seen[0] && seen.every((c, i) => !i || c >= seen[i - 1]);
    results[id] = { notes: n, game, colored: hook?.colored, svgPerfect, cursor, errors };
    say(`verify-sheet: ${id} game PERFECT ${game?.PERFECT}/${n}; sheet colored ${JSON.stringify(hook?.colored)}, ${svgPerfect} gold noteheads in the SVG; cursor ${rises ? "rose" : "did not rise"} (${seen.length} samples)`);
    if (!rises) fail.push(`${id}: the cursor didn't rise during the take: ${JSON.stringify(cursor)}`);
    if (errors.length) fail.push(`${id}: page errors: ${errors.join("; ")}`);
    if (EXACT.includes(id)) {
      if (game?.PERFECT !== n) fail.push(`${id}: the game judged ${game?.PERFECT}/${n} PERFECT, so the sheet can't be checked`);
      if (hook?.colored?.PERFECT !== n) fail.push(`${id}: colored.PERFECT ${hook?.colored?.PERFECT}, want ${n}`);
      if (svgPerfect !== n) fail.push(`${id}: ${svgPerfect} gold noteheads in the SVG, want ${n}`);
    } else if (!hook?.colored?.PERFECT) fail.push(`${id}: no notehead painted`);
  }
}

try {
  await (isStatic ? staticRun() : followRun());
  writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
if (fail.length) {
  say(`verify-sheet: FAIL\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
say(
  isStatic
    ? `verify-sheet: pass, ${ids.length} charts render with noteheads and no error (evidence: ${out})`
    : `verify-sheet: pass, the sheet followed ${follows.join(", ")} (evidence: ${out})`,
);
process.exit(0);
