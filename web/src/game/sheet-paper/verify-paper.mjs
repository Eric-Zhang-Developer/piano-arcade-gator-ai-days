// Headless proof of sheet-paper (spec: sheet-paper, Validation 1). Its own `next dev`, at 1280×720 and 1920×1080:
// 1. /sheet?song=twinkle: the score sits on a paper panel (--pa-paper background), a staff line is drawn in the paper
//    ink, and no element on the page has a CSS filter (notation is never inverted).
// 2. /sheet?song=twinkle&review=1 with a stored take that holds every judgment: each judged notehead's fill has at
//    least 3:1 contrast against the paper, computed in the page.
// 3. Screenshots sheet-<size>.png and review-<size>.png.
// The stored take is a fixture: Twinkle's chart with PERFECT, GREAT, GOOD and MISS in turn, so every hue is painted
// (a bot's take may have no GOOD at all).
// Usage: node web/src/game/sheet-paper/verify-paper.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-paper.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

const PAPER = [242, 237, 227]; // --pa-paper, #f2ede3 (decision duo-tokens-paper)
const PAPER_INK = [22, 19, 15]; // --pa-paper-ink, #16130f
const MIN_CONTRAST = 3; // WCAG 3:1 for a notehead on the paper
const JUDGMENTS = ["PERFECT", "GREAT", "GOOD", "MISS"];
const REVIEW_KEY = "pianoArcade.sheetReview"; // sheet-review's

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-paper: starting next dev on ${port}`);
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
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${base}/sheet?song=twinkle`)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 240) throw new Error("server not ready after 120 s");
  await new Promise((r) => setTimeout(r, 500));
}

const failures = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};

const chart = await (await fetch(`${base}/songs/twinkle/chart.json`)).json();
const review = {
  chart,
  judgments: Object.fromEntries(chart.notes.map((n, i) => [n.id, JUDGMENTS[i % JUDGMENTS.length]])),
  startedAt: new Date().toISOString(),
  accuracy: 0.5,
};

// In the page: what the paper, the staff and the noteheads are drawn in. Colors come back as [r, g, b].
const READ = ([paper, paperInk]) => {
  const rgb = (css) => {
    if (!css || css === "none") return null;
    const hex = css.match(/^#([0-9a-f]{6})/i);
    if (hex) return [0, 2, 4].map((k) => parseInt(hex[1].slice(k, k + 2), 16));
    const m = css.match(/rgba?\(([^)]+)\)/);
    return m ? m[1].split(/[ ,/]+/).slice(0, 3).map(Number) : null;
  };
  const lum = (c) =>
    c.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, k) => s + v * [0.2126, 0.7152, 0.0722][k], 0);
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const same = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
  const panel = document.querySelector("[data-paper]");
  const staff = document.querySelector(".vf-measure > path[stroke]"); // VexFlow draws a stave's lines straight into OSMD's measure group
  const staffColor = staff && rgb(staff.getAttribute("stroke") ?? getComputedStyle(staff).stroke);
  const filtered = [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).filter !== "none").map((el) => el.tagName.toLowerCase() + (el.className?.baseVal ?? el.className ? `.${el.className?.baseVal ?? el.className}` : ""));
  const heads = [...document.querySelectorAll(".vf-notehead path, .vf-notehead")].filter((el) => el.tagName.toLowerCase() === "path");
  const fills = new Map();
  for (const el of heads) {
    const c = rgb(el.getAttribute("fill") ?? getComputedStyle(el).fill);
    if (!c || same(c, paperInk)) continue; // an unjudged notehead, in ink
    fills.set(c.join(","), { color: c, contrast: Math.round(contrast(c, paper) * 100) / 100 });
  }
  return {
    panelBg: panel && rgb(getComputedStyle(panel).backgroundColor),
    staffColor,
    filtered: filtered.slice(0, 5),
    filteredCount: filtered.length,
    heads: heads.length,
    judgedFills: [...fills.values()],
    hook: window.__pianoArcadeSheet ? { review: window.__pianoArcadeSheet.review, colored: window.__pianoArcadeSheet.colored } : null,
  };
};
const hex = (c) => (c ? `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}` : String(c));
const same = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);

const browser = await chromium.launch();
const errors = [];
try {
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    const tag = `${w}x${h}`;
    // 1. The plain score.
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag} /sheet: ${e.message}`));
    await page.goto(`${base}/sheet?song=twinkle`);
    await page.locator('[data-sheet="ready"]').waitFor({ timeout: 90_000 });
    await page.waitForTimeout(500);
    const plain = await page.evaluate(READ, [PAPER, PAPER_INK]);
    check(same(plain.panelBg, PAPER), `${tag} 1: the score's panel is the paper (${hex(plain.panelBg)}, want ${hex(PAPER)})`);
    check(same(plain.staffColor, PAPER_INK), `${tag} 1: a staff line is the paper ink (${hex(plain.staffColor)}, want ${hex(PAPER_INK)})`);
    check(plain.filteredCount === 0, `${tag} 1: no element has a CSS filter (${plain.filteredCount}${plain.filteredCount ? `: ${plain.filtered.join(", ")}` : ""})`);
    await page.screenshot({ path: join(out, `sheet-${tag}.png`) });
    await ctx.close();

    // 2. A stored take on the paper.
    const rctx = await browser.newContext({ viewport: { width: w, height: h } });
    await rctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [REVIEW_KEY, JSON.stringify(review)]);
    const rpage = await rctx.newPage();
    rpage.on("pageerror", (e) => errors.push(`${tag} /sheet?review=1: ${e.message}`));
    await rpage.goto(`${base}/sheet?song=twinkle&review=1`);
    await rpage.locator('[data-sheet="ready"]').waitFor({ timeout: 90_000 });
    await rpage.waitForFunction(() => window.__pianoArcadeSheet?.review === true, null, { timeout: 30_000 });
    await rpage.waitForTimeout(500);
    const judged = await rpage.evaluate(READ, [PAPER, PAPER_INK]);
    const colored = judged.hook?.colored ?? {};
    check(
      JUDGMENTS.every((j) => colored[j] > 0),
      `${tag} 2: the review painted every judgment (${JUDGMENTS.map((j) => `${j} ${colored[j] ?? 0}`).join(", ")})`,
    );
    const worst = judged.judgedFills.reduce((a, f) => (a && a.contrast <= f.contrast ? a : f), null);
    check(
      judged.judgedFills.length >= JUDGMENTS.length && judged.judgedFills.every((f) => f.contrast >= MIN_CONTRAST),
      `${tag} 2: every judged notehead has at least ${MIN_CONTRAST}:1 on the paper (${judged.judgedFills.map((f) => `${hex(f.color)} ${f.contrast}:1`).join(", ") || "none found"}; lowest ${worst ? `${worst.contrast}:1` : "n/a"})`,
    );
    await rpage.screenshot({ path: join(out, `review-${tag}.png`) });
    await rctx.close();
  }
} catch (e) {
  failures.push(e.message);
  say(`FAIL ${e.message}`);
} finally {
  await browser.close();
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
say(failures.length ? `verify-paper: FAIL, ${failures.length} step(s)` : `verify-paper: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
