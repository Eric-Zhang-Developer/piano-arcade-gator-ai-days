// Headless proof of wait mode (spec: wait-mode, the Chrome steps): on /play?mode=wait, Twinkle's first note holds on
// the line for 3 s until it's pressed, then the song plays on and ends with no MISS and no rank; Ode to Joy's opening
// chord holds until both of its keys are pressed. "Play it judged" and "Learn it first" move between the two modes.
// Usage: node web/src/game/wait-mode/verify-wait.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-wait.mjs --out <dir>");
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
say(`verify-wait: starting next dev on ${port}`);
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
const now = (page) => page.evaluate(() => window.__pianoArcade.now());

async function open(page, song) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/play?song=${song}&input=test&beat=off&stage=off&mode=wait`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  return page.evaluate(() => window.__pianoArcade.chart);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. Twinkle: the first note (beat 0) holds; pressed 3 s late, it's judged on time and the song plays on.
let chart = await open(page, "twinkle");
await page.waitForFunction(() => window.__pianoArcade.now() >= 0, null, { timeout: 30_000 });
await page.waitForTimeout(3000);
const held = await now(page);
check(held === 0, `Twinkle's first note holds the clock at 0 ms for 3 s (clock ${held})`);
await page.screenshot({ path: join(out, "wait-held.png") });
const mpb = 60000 / chart.bpm;
const first = chart.notes.find((n) => n.beat === 0);
await page.evaluate((p) => window.__pianoArcade.press(p, 0), first.pitch);
await page.waitForTimeout(500);
check((await now(page)) > 0, "after the press, the clock moves on");
// The rest, each pressed only once the clock has stopped on it, as a learner would.
await page.evaluate(async (notes) => {
  const hook = window.__pianoArcade;
  for (const [p, t] of notes) {
    while (hook.now() < t) await new Promise(requestAnimationFrame);
    hook.press(p, t);
  }
}, chart.notes.filter((n) => n !== first).map((n) => [n.pitch, n.beat * mpb]));
await page.getByTestId("results").waitFor({ timeout: 120_000 });
const r = await page.evaluate(() => window.__pianoArcade.results);
check(r.counts.MISS === 0, `no MISS (${r.counts.MISS})`);
check(r.judgments.every((j) => j.offsetMs === 0), "every note judged at offset 0");
check(await page.getByTestId("unscored").isVisible(), "the results say 'not scored'");
check((await page.getByTestId("rank").count()) === 0 && (await page.getByTestId("timing").count()) === 0, "no rank, counts or timing panel");
await page.screenshot({ path: join(out, "wait-results.png") });
await page.getByTestId("play-judged").click();
await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
const judged = new URL(page.url());
check(!judged.searchParams.has("mode") && judged.searchParams.get("song") === "twinkle", `"Play it judged" opens ${judged.pathname}${judged.search}`);
await page.getByTestId("results").waitFor({ timeout: 120_000 }); // nothing pressed: the normal game calls every note a MISS
check(await page.getByTestId("rank").isVisible(), "… the normal game, with a rank");

// The start screen (no ?input=test, so it waits for Start) links into wait mode.
await page.goto(`${base}/play?song=twinkle&hands=R`);
await page.getByTestId("learn-first").click();
await page.waitForURL(/mode=wait/);
check(new URL(page.url()).search === "?song=twinkle&hands=R&mode=wait", `"Learn it first" opens ${new URL(page.url()).search}`);

// 2. Ode to Joy opens on a chord: one key isn't enough.
chart = await open(page, "ode-to-joy");
const chord = chart.notes.filter((n) => n.beat === 0).map((n) => n.pitch);
check(chord.length === 2, `Ode to Joy opens on a two-note chord (${chord.join(", ")})`);
await page.waitForFunction(() => window.__pianoArcade.now() >= 0, null, { timeout: 30_000 });
await page.evaluate((p) => window.__pianoArcade.press(p, 0), chord[0]);
await page.waitForTimeout(1500);
check((await now(page)) === 0, "with one key of the chord pressed, the clock still holds");
await page.evaluate((p) => window.__pianoArcade.press(p, 0), chord[1]);
await page.waitForTimeout(500);
check((await now(page)) > 0, "with both keys pressed, it moves on");

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-wait.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-wait: ${failures.length} failed` : "verify-wait: all checks passed");
process.exit(failures.length ? 1 : 0);
