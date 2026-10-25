// Headless proof of sheet-beams (spec: Validation).
// 1. Each library chart's /sheet beams every note shouldBeam says it should: beams.beamed === beams.should.
// 2. /sheet beside /play?input=test: a Perfect Ode to Joy turns every beam gold; a sloppy one (every third note 60 ms
//    late) colors a beam only when all its notes share a judgment, and leaves every other beam ink.
// 3. Readability: after the Perfect take, a full-page shot at 1920×1080; pixels within ΔE76 10 of PERFECT's gold, per
//    note, must beat the same page with only its beams repainted ink, as it drew before sheet-beams.
// Usage: node web/src/game/sheet-beams/verify-beams.mjs --out <dir> [--url <running server>] [--measure-only]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
if (!arg("--out")) {
  console.error("usage: verify-beams.mjs --out <dir> [--url <server>] [--measure-only]");
  process.exit(2);
}
const out = resolve(arg("--out"));
mkdirSync(out, { recursive: true });
const measureOnly = process.argv.includes("--measure-only");
const say = (s) => process.stdout.write(`${s}\n`);
// The score is ink on paper since #730 (sheet-paper). sheet-beams.test.ts pins these to their sources.
const INK = "#16130f"; // ui-tokens' paperInk, unjudged music
const BG = "#f2ede3"; // ui-tokens' paper, behind the score
const GOLD = "#9b7900"; // paperJudgmentColors.PERFECT: the HUD's gold, darkened for the paper

let base = arg("--url");
let server;
if (!base) {
  const port = await new Promise((res, rej) => {
    const s = createServer().once("error", rej);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
  base = `http://localhost:${port}`;
  say(`verify-beams: starting next dev on ${port}`);
  server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
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
}

const browser = await chromium.launch({ headless: true });
const fail = [];
const results = {};

// 1. Beaming, every library chart.
if (!measureOnly) {
  const songsDir = join(webDir, "public/songs");
  const ids = readdirSync(songsDir).filter((d) => existsSync(join(songsDir, d, "chart.json"))).sort();
  results.beams = {};
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${base}/sheet?song=${id}`);
    await page.locator('main[data-sheet="ready"]').waitFor({ timeout: 90_000 });
    const beams = await page.evaluate(() => window.__pianoArcadeSheet?.beams ?? null);
    results.beams[id] = beams;
    const ok = beams && beams.beamed === beams.should;
    say(`${ok ? "ok  " : "FAIL"} 1. ${id}: ${beams ? `${beams.beamed} of ${beams.should} notes beamed` : "no beams on the page hook"}`);
    if (!ok) fail.push(`1. ${id}: beamed ${beams?.beamed}, should ${beams?.should}`);
    await page.close();
  }
}

// A take of Ode to Joy on /play beside /sheet in one context; returns the sheet page, still open.
async function take(context, sloppy) {
  const sheet = await context.newPage();
  await sheet.goto(`${base}/sheet?song=ode-to-joy`);
  await sheet.locator('main[data-sheet="ready"]').waitFor({ timeout: 90_000 });
  const play = await context.newPage();
  await play.goto(`${base}/play?song=ode-to-joy&input=test`);
  await play.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 90_000 });
  const chart = await play.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await play.evaluate(
    ([notes, mpb, sloppy]) => notes.forEach((n, i) => window.__pianoArcade.press(n.pitch, n.beat * mpb + (sloppy && i % 3 === 0 ? 60 : 0))),
    [chart.notes, mpb, sloppy],
  );
  const last = Math.max(...chart.notes.map((n) => n.beat + n.duration)) * mpb;
  await play.locator('[data-testid="results"]').waitFor({ timeout: last + 60_000 });
  await sheet.waitForTimeout(800); // the last judgments cross the channel
  const counts = await play.evaluate(() => window.__pianoArcade.results?.counts);
  await play.close();
  return { sheet, counts, notes: chart.notes.length };
}

// 3's measure: pixels within ΔE76 10 of the gold in a full-page shot, counted in a canvas on the page itself.
async function goldPixels(page, path) {
  const png = await page.screenshot({ path, fullPage: true });
  return page.evaluate(
    async ([b64, hex]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      [c.width, c.height] = [img.width, img.height];
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const lab = (r, g, b) => {
        const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        const [R, G, B] = [lin(r), lin(g), lin(b)];
        const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
        const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
        const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
        const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
      };
      const [L0, a0, b0] = lab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const [L, a, b] = lab(d[i], d[i + 1], d[i + 2]);
        if ((L - L0) ** 2 + (a - a0) ** 2 + (b - b0) ** 2 <= 100) n++;
      }
      return n;
    },
    [png.toString("base64"), GOLD],
  );
}

// 2 and 3: the Perfect take.
{
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const { sheet, counts, notes } = await take(context, false);
  const px = await goldPixels(sheet, join(out, "ode-to-joy-perfect-1920.png"));
  results.perfect = { counts, goldPixels: px, perNote: px / notes };
  say(`verify-beams: Perfect take ${JSON.stringify(counts)}; ${px} gold pixels, ${(px / notes).toFixed(1)} a note`);
  if (counts?.PERFECT !== notes) fail.push(`2. the game judged ${counts?.PERFECT}/${notes} PERFECT, so the sheet can't be checked`);
  if (!measureOnly) {
    const audit = await sheet.evaluate(() => window.__pianoArcadeSheet.beamAudit());
    const notGold = audit.filter((a) => a.fill !== GOLD);
    say(`${notGold.length || !audit.length ? "FAIL" : "ok  "} 2. Perfect: ${audit.length - notGold.length} of ${audit.length} beams gold`);
    if (!audit.length) fail.push("2. Perfect: no beams drawn");
    if (notGold.length) fail.push(`2. Perfect: ${notGold.length} beams not gold: ${JSON.stringify(notGold)}`);
    // The baseline: every beam line back to ink, as VexFlow names them in follow.ts (vf-<first note>-beam…).
    const inked = await sheet.evaluate((ink) => {
      const els = [...document.querySelectorAll('[id^="vf-"][id*="-beam"]')].flatMap((g) => [g, ...g.querySelectorAll("*")]);
      for (const el of els) for (const a of ["fill", "stroke"]) el.setAttribute(a, ink);
      return els.length;
    }, INK);
    const base = (await goldPixels(sheet, join(out, "ode-to-joy-perfect-ink-beams-1920.png"))) / notes;
    results.perfect.inkBeamsPerNote = base;
    const better = inked > 0 && px / notes > base;
    say(`${better ? "ok  " : "FAIL"} 3. ${(px / notes).toFixed(1)} gold pixels a note, ${base.toFixed(1)} with ink beams`);
    if (!better) fail.push(`3. ${(px / notes).toFixed(1)} gold pixels a note isn't above ${base.toFixed(1)} with ink beams (${inked} beam elements)`);
  }
  await context.close();
}

// 2: the sloppy take. A colored beam's notes all share its judgment; an ink beam's don't.
if (!measureOnly) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const { sheet, counts } = await take(context, true);
  const colors = await sheet.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('ul[aria-label="Note colors"] li')].map((li) => {
        const [r, g, b] = getComputedStyle(li.querySelector("span")).backgroundColor.match(/\d+/g).map(Number);
        return [li.textContent.trim(), `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`];
      }),
    ),
  );
  const audit = await sheet.evaluate(() => window.__pianoArcadeSheet.beamAudit());
  const wrong = audit.filter((a) => {
    const [j] = a.judgments;
    const agree = !!j && a.judgments.every((x) => x === j);
    return agree ? a.fill !== colors[j] : a.fill !== INK;
  });
  const colored = audit.filter((a) => a.fill !== INK).length;
  results.sloppy = { counts, colors, beams: audit.length, colored, wrong };
  say(`${wrong.length ? "FAIL" : "ok  "} 2. sloppy ${JSON.stringify(counts)}: ${colored} of ${audit.length} beams colored, each over notes that agree`);
  if (wrong.length) fail.push(`2. sloppy: ${wrong.length} beams painted against the rule: ${JSON.stringify(wrong)}`);
  // Each judgment color's luminance ratio against ink and the page, for the done note.
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (x, y) => (Math.max(lum(x), lum(y)) + 0.05) / (Math.min(lum(x), lum(y)) + 0.05);
  results.luminance = Object.fromEntries(Object.entries(colors).map(([j, c]) => [j, { vsInk: +ratio(c, INK).toFixed(2), vsBg: +ratio(c, BG).toFixed(2) }]));
  say(`verify-beams: luminance ratios ${JSON.stringify(results.luminance)}`);
  await context.close();
}

await browser.close();
writeFileSync(join(out, "results.json"), JSON.stringify({ results, fail }, null, 2));
if (measureOnly) say(`verify-beams: measured (evidence: ${out})`);
else if (fail.length) {
  for (const f of fail) say(`FAIL ${f}`);
  say(`verify-beams: fail (evidence: ${out})`);
  process.exit(1);
} else say(`verify-beams: pass (evidence: ${out})`);
process.exit(0);
