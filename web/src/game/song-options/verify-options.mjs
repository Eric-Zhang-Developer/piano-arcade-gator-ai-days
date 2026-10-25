// Headless proof of song-options (spec: song-options, Validation). Starts its own dev server.
// 1. On /, focus Für Elise, press H then ←: Right and 70% are pressed and the panel reads "practice · not recorded".
// 2. Enter opens song=fur-elise&hands=R&tempo=70; that chart is only the R notes at 0.7× the bpm; a perfect take shows
//    no NEW RECORD and saves no record.
// 3. After a reload Für Elise still shows Right and 70%; Twinkle shows no Hands, 100%, and href /play?song=twinkle.
// 4. L on Für Elise opens mode=wait&hands=R&tempo=70, and LEARN's href matches.
// 5. Screenshots of the panel at 1280×720 and 1920×1080; for every song the preview ends above the footer (Options,
//    first-run's link), the footer stays on screen and the page doesn't scroll.
// Usage: node web/src/game/song-options/verify-options.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-options.mjs --out <dir>");
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
say(`verify-options: starting next dev on ${port}`);
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
  const pressed = async (id) => (await page.getByTestId(id).getAttribute("aria-pressed")) === "true";
  // Focus a song on / and wait for its preview's chart (Hands shows once the chart says it has both hands).
  const focus = async (id, twoHands) => {
    await page.getByTestId(`song-${id}`).focus();
    await page.getByTestId("song-options").waitFor({ timeout: 60_000 });
    if (twoHands) await page.getByTestId("hands-R").waitFor({ timeout: 10_000 });
    // The chart has loaded: song-preview's PRACTICE 70% shows, or duo-select's PRACTICE turns on.
    else await page.locator('[data-testid="preview-practice"], [data-testid="select-practice"]:not([disabled])').first().waitFor({ timeout: 10_000 });
  };
  const home = async () => {
    await page.goto(`${base}/`);
    await page.getByTestId("song-fur-elise").waitFor({ timeout: 60_000 });
  };

  // 1. Für Elise, H then ←.
  await home();
  await page.evaluate(() => ["pianoArcade.songOptions", "pianoArcade.level", "pianoArcade.records"].forEach((k) => localStorage.removeItem(k)));
  await home();
  await focus("fur-elise", true);
  await page.keyboard.press("h");
  await page.keyboard.press("ArrowLeft");
  const practice = await page.getByTestId("options-practice").textContent().catch(() => "");
  check((await pressed("hands-R")) && (await pressed("speed-70")) && practice === "practice · not recorded", `H then ← on Für Elise: Right and 70% pressed, panel reads "${practice}"`);

  // 2. Enter plays it with the options; the chart is the right hand at 0.7× and a perfect take is no record.
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/play\?/, { timeout: 30_000 });
  const q = new URL(page.url()).searchParams.toString();
  check(q === "song=fur-elise&hands=R&tempo=70", `Enter opens /play?${q}`);
  const file = await (await fetch(`${base}/songs/fur-elise/chart.json`)).json();
  const right = file.notes.filter((n) => n.hand === "R");
  await page.goto(`${base}/play?${q}&input=test`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  check(chart.notes.length === right.length && chart.notes.every((n) => n.hand === "R"), `the chart is the right hand only: ${chart.notes.length} of chart.json's ${right.length} R notes`);
  check(Math.abs(chart.bpm - file.bpm * 0.7) < 1e-6, `bpm is 0.7× chart.json's (${chart.bpm} vs ${file.bpm})`);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  const lastBeat = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  await page.waitForSelector('[data-testid="results"]', { timeout: lastBeat * mpb + 30_000 });
  const results = await page.evaluate(() => window.__pianoArcade.results);
  // Visible only: the help card (a closed <dialog> on every page) reads "initials for a new record", and getByText is
  // case-insensitive and counts hidden text.
  const recordShown = await page.getByText("NEW RECORD").filter({ visible: true }).count();
  const records = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("pianoArcade.records") ?? "{}")));
  check(results?.accuracy === 1 && recordShown === 0 && !records.length, `a perfect take: ${results ? `${(results.accuracy * 100).toFixed(1)}%` : "no results"}, no NEW RECORD, records [${records.join(", ")}]`);
  await page.screenshot({ path: join(out, "fur-elise-right-70-results.png") });

  // 3. A reload remembers Für Elise; Twinkle (one hand) has no Hands, default Speed and a plain href.
  await home();
  await focus("fur-elise", true);
  check((await pressed("hands-R")) && (await pressed("speed-70")), "after a reload Für Elise still shows Right and 70%");
  await focus("twinkle", false);
  const twinkleHref = await page.getByTestId("song-twinkle").getAttribute("href");
  check((await page.locator('[data-testid^="hands-"]').count()) === 0 && (await pressed("speed-100")) && twinkleHref === "/play?song=twinkle", `Twinkle: no Hands, 100%, href ${twinkleHref}`);

  // 4. L on Für Elise learns with the options; LEARN's href, where there is one, is the same URL.
  await focus("fur-elise", true);
  // duo-select's panel has no LEARN link (L is the way in), so the href check runs only where it's drawn.
  const learnHref = (await page.getByTestId("preview-learn").count()) ? await page.getByTestId("preview-learn").getAttribute("href") : null;
  await page.keyboard.press("l");
  await page.waitForURL(/\/play\?/, { timeout: 30_000 });
  const learn = new URL(page.url());
  const lp = learn.searchParams;
  check(lp.get("mode") === "wait" && lp.get("hands") === "R" && lp.get("tempo") === "70", `L opens /play?${lp}`);
  if (learnHref !== null) check(learnHref === `${learn.pathname}${learn.search}`, `LEARN's href matches (${learnHref})`);

  // 5. The panel at both sizes.
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await home();
    await focus("fur-elise", true);
    await page.getByTestId("first-run-link").waitFor({ timeout: 10_000 });
    await page.screenshot({ path: join(out, `panel-${w}.png`) });
    // For every song (titles wrap to two lines; one-hand charts have no Hands row): the left column's footer (Options
    // and first-run's link, in flow under the preview since #492) stays on screen, nothing of the preview runs under it,
    // and the page doesn't scroll.
    const gaps = [];
    for (const id of await page.$$eval('ol a[data-testid^="song-"]', (a) => a.map((e) => e.dataset.testid.slice(5)))) {
      await focus(id, false);
      gaps.push([id, await page.evaluate(() => {
        const footer = ["first-run-link", "options-open"].map((t) => document.querySelector(`[data-testid="${t}"]`).getBoundingClientRect());
        // The focus section can shrink (min-height: 0) and draw the preview under the footer: its lowest box, any
        // descendant since children overflow, must end above the footer's top.
        const preview = Math.max(...[...document.querySelectorAll('[data-testid="song-preview"] *')].map((e) => e.getBoundingClientRect().bottom));
        const scroll = document.documentElement.scrollHeight - innerHeight;
        if (scroll > 0) return -Math.round(scroll);
        // Nothing in the focused song is squeezed: with flex-shrink off, every box keeps its height. (The title clips
        // its overflow, so a short column shrank it and cut the title in half, with no overlap to see.)
        const boxes = [document.querySelector('[data-testid="song-preview"]').closest("section"), ...document.querySelector('[data-testid="song-preview"]').closest("section").children];
        const heights = boxes.map((e) => e.getBoundingClientRect().height);
        boxes.forEach((e) => (e.style.flexShrink = "0"));
        const squeezed = boxes.map((e, i) => e.getBoundingClientRect().height - heights[i]);
        boxes.forEach((e) => (e.style.flexShrink = ""));
        if (Math.max(...squeezed) > 0.5) return -Math.round(Math.max(...squeezed));
        return Math.round(Math.min(Math.min(...footer.map((r) => r.top)) - preview, innerHeight - Math.max(...footer.map((r) => r.bottom))));
      })]);
    }
    const [worst, least] = gaps.reduce((m, g) => (g[1] < m[1] ? g : m));
    check(least >= 0, `${w}×${h}: every song fits: nothing squeezed, the preview above the footer, the footer on screen, no page scroll (closest: ${worst}, ${least}px; panel-${w}.png)`);
  }
  writeFileSync(join(out, "results.json"), JSON.stringify({ q, results, records, twinkleHref, learnHref }, null, 2));
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
if (fail.length) {
  say("verify-options: FAIL");
  for (const f of fail) say(`  ${f}`);
  process.exit(1);
}
say(`verify-options: pass (evidence: ${out})`);
process.exit(0);
