// Headless proof of easy-charts (spec: easy-charts, Validation). Starts its own dev server.
// 1. /play?song=chopin-prelude-4&input=test has chart.json's notes; with &level=easy it has fewer, every id is one of
//    chart.json's, and pressing every note on time gives 100%.
// 2. After a perfect Easy take of Twinkle, records hold twinkle@easy and no twinkle entry.
// 3. On /, E makes the toggle read Easy and the focused card's href end in &level=easy; a reload keeps it; E again
//    removes it.
// 4. Screenshots of the toggle in both states at 1280×720 and 1920×1080.
// Usage: node web/src/game/easy-charts/verify-easy.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// select-calm (#1411): Learn, Flow, the level, Hands, Speed and the source sit in the Practice panel; open it first.
const openPractice = async (p) => {
  const b = p.getByTestId("practice-open");
  await b.waitFor({ timeout: 60_000 });
  if ((await b.getAttribute("aria-expanded")) !== "true") await b.click();
};

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-easy.mjs --out <dir>");
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
say(`verify-easy: starting next dev on ${port}`);
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

// The chart /play actually plays (the test hook's), and optionally a perfect take of it: every note pressed on time.
async function play(page, query, perfect) {
  await page.goto(`${base}/play?${query}&input=test`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  if (!perfect) return { chart };
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  const lastBeat = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  await page.waitForSelector('[data-testid="results"]', { timeout: lastBeat * mpb + 30_000 });
  return { chart, results: await page.evaluate(() => window.__pianoArcade.results) };
}

const browser = await chromium.launch({ headless: true });
const fail = [];
const check = (ok, what) => {
  say(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) fail.push(what);
};
try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(`${base}/play`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  context.on("weberror", (e) => errors.push(e.error().message));
  const page = await context.newPage();

  // 1. Chopin, Normal then Easy.
  const file = await (await fetch(`${base}/songs/chopin-prelude-4/chart.json`)).json();
  const normal = await play(page, "song=chopin-prelude-4", false);
  check(normal.chart.notes.length === file.notes.length, `Normal Chopin has chart.json's ${file.notes.length} notes (${normal.chart.notes.length})`);
  const easy = await play(page, "song=chopin-prelude-4&level=easy", true);
  const ids = new Set(file.notes.map((n) => n.id));
  check(easy.chart.notes.length < file.notes.length, `Easy Chopin has fewer notes: ${easy.chart.notes.length} of ${file.notes.length}`);
  check(easy.chart.notes.every((n) => ids.has(n.id)), "every Easy note id is one of chart.json's");
  check(easy.results?.accuracy === 1, `pressing every Easy note gives 100% (${easy.results ? `${(easy.results.accuracy * 100).toFixed(1)}%` : "no results"})`);
  await page.screenshot({ path: join(out, "chopin-easy-results.png"), fullPage: true });

  // 2. A perfect Easy Twinkle saves under twinkle@easy only.
  await page.evaluate(() => localStorage.removeItem("pianoArcade.records"));
  const twinkle = await play(page, "song=twinkle&level=easy", true);
  const keys = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("pianoArcade.records") ?? "{}")));
  check(twinkle.results?.accuracy === 1 && keys.includes("twinkle@easy") && !keys.includes("twinkle"), `an Easy Twinkle take saves under twinkle@easy and not twinkle (${keys.join(", ") || "none"})`);
  writeFileSync(join(out, "results.json"), JSON.stringify({ chopin: easy.results, twinkle: twinkle.results, records: keys }, null, 2));

  // 3 and 4. The select: E, a reload, E again; the toggle at both sizes in both states.
  await page.evaluate(() => localStorage.removeItem("pianoArcade.level"));
  const toggle = page.getByTestId("level-easy"); // the Easy chip (mouse-first): pressed when the level is Easy
  const href = () => page.getByTestId("song-twinkle").getAttribute("href");
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${base}/`);
    await openPractice(page);
    await toggle.waitFor({ timeout: 60_000 });
    await page.getByText(/EASY Lv \d/).waitFor({ timeout: 10_000 }); // the focused chart's Easy level has loaded
    await page.screenshot({ path: join(out, `toggle-normal-${w}.png`) });
    await page.keyboard.press("e");
    check((await toggle.getAttribute("aria-pressed")) === "true" && (await href()).endsWith("&level=easy"), `${w}×${h}: E reads Easy and the focused card's href ends in &level=easy (${await href()})`);
    await page.screenshot({ path: join(out, `toggle-easy-${w}.png`) });
    await page.reload();
    await openPractice(page);
    await toggle.waitFor({ timeout: 60_000 });
    // The server renders Normal; the stored level arrives at hydration. The Easy level is filled in by a client fetch
    // after hydration, so once it shows, the toggle reads the stored level (reading at once raced it: #532).
    await page.getByText(/EASY Lv \d/).waitFor({ timeout: 10_000 });
    check((await toggle.getAttribute("aria-pressed")) === "true", `${w}×${h}: still Easy after a reload`);
    await page.keyboard.press("e");
    check((await toggle.getAttribute("aria-pressed")) === "false" && !(await href()).includes("level="), `${w}×${h}: E again goes back to Normal (${await href()})`);
    await toggle.click(); // the chips, by mouse (mouse-first): Easy, then Normal
    check((await toggle.getAttribute("aria-pressed")) === "true" && (await href()).endsWith("&level=easy"), `${w}×${h}: clicking EASY reads Easy (${await href()})`);
    await page.getByTestId("level-normal").click();
    check((await toggle.getAttribute("aria-pressed")) === "false" && !(await href()).includes("level="), `${w}×${h}: clicking NORMAL goes back (${await href()})`);
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
if (fail.length) {
  say("verify-easy: FAIL");
  for (const f of fail) say(`  ${f}`);
  process.exit(1);
}
say(`verify-easy: pass (evidence: ${out})`);
process.exit(0);
