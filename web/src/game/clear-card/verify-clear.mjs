// Headless proof of the clear card on Twinkle: each bot's take shows the right card after the last note, gone before
// the results, never over 1.5 s, and no FULL COMBO banner. One screenshot each. ?beat=off keeps the laptop click out.
// Usage: node web/src/game/clear-card/verify-clear.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-clear.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

const RUNS = [
  { bot: "perfect", w: 1920, h: 1080, kind: "ALL PERFECT" },
  { bot: "perfect", w: 1280, h: 720, kind: "ALL PERFECT" },
  { bot: "perfect", w: 1024, h: 768, kind: "ALL PERFECT" },
  { bot: "late", w: 1920, h: 1080, kind: "FULL COMBO" },
  { bot: "rank-c", w: 1920, h: 1080, kind: "CLEAR" },
  { bot: "perfect", w: 1280, h: 720, kind: "ALL PERFECT", motion: "reduce" },
];

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}/play?beat=off`;
say(`verify-clear: starting next dev on ${port}`);
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
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const fail = [];
  const report = [];
  for (const run of RUNS) {
    const name = `${run.bot}-${run.w}${run.motion ? `-${run.motion}` : ""}`;
    const page = await browser.newPage({ viewport: { width: run.w, height: run.h }, reducedMotion: run.motion ?? "no-preference" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${base}&bot=${run.bot}`);
    // Every change of the card, when the results appear, and whether a full-combo banner ever shows.
    await page.evaluate(() => {
      window.__clearLog = [];
      window.__banner = false;
      let was = "none";
      const tick = () => {
        const c = window.__pianoArcadeClearCard;
        const now = c ? c.kind : "none";
        if (now !== was) window.__clearLog.push({ kind: now, at: performance.now() });
        was = now;
        if (document.querySelector('[data-testid="full-combo"]')) window.__banner = true;
        if (document.querySelector('[data-testid="results"]') && !window.__resultsAt) window.__resultsAt = performance.now();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 });
    await page.waitForFunction(() => !!window.__pianoArcadeClearCard, null, { timeout: 90_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, `${name}.png`) });
    await page.waitForSelector('[data-testid="results"]', { timeout: 30_000 });
    await page.waitForTimeout(200);
    const { log, resultsAt, banner } = await page.evaluate(() => ({ log: window.__clearLog, resultsAt: window.__resultsAt, banner: window.__banner }));
    const shown = log.find((e) => e.kind !== "none");
    const final = log.filter((e) => e.kind !== "none").at(-1);
    const goneAt = log.find((e) => shown && e.kind === "none" && e.at > shown.at)?.at;
    const ms = shown && goneAt ? Math.round(goneAt - shown.at) : null;
    const f = [];
    if (!shown) f.push("the card never showed");
    if (final && final.kind !== run.kind) f.push(`card ${final.kind}, want ${run.kind}`);
    if (ms === null || ms > 1500) f.push(`card showed ${ms} ms, want ≤ 1500`);
    if (goneAt && resultsAt && goneAt > resultsAt + 1) f.push("the card outlived the results' first frame");
    if (banner) f.push("a full-combo banner showed");
    f.push(...errors);
    report.push({ name, kind: final?.kind, ms, log });
    say(`verify-clear: ${name}: ${final?.kind ?? "no card"} for ${ms} ms${f.length ? ` FAIL ${f.join("; ")}` : ""}`);
    fail.push(...f.map((s) => `${name}: ${s}`));
    await page.close();
  }
  writeFileSync(join(out, "clear.json"), JSON.stringify(report, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-clear: pass, ALL PERFECT at 1920, 1280 and 1024 (and reduced motion), FULL COMBO for bot=late, CLEAR for bot=rank-c, each gone before the results (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-clear: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
