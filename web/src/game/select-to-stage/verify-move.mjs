// Headless proof of select to stage: Enter on Twinkle at / starts one view transition whose stage-jacket group
// animates for at most 400 ms into /play's stage card; under reduced motion none starts. Runs `next build` and
// `next start` (dev compiles /play on its first visit, which would make the move a cut). Screenshots at 0 ms, 200 ms
// and settled, at 1280×720 and 1920×1080.
// Usage: node web/src/game/select-to-stage/verify-move.mjs --out <dir> [--no-build]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-move.mjs --out <dir> [--no-build]");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const next = join(webDir, "node_modules/.bin/next");

if (!process.argv.includes("--no-build")) {
  say("verify-move: next build");
  if (spawnSync(next, ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] }).status !== 0) process.exit(1);
}
const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-move: next start on ${port}`);
const server = spawn(next, ["start", "--port", String(port)], { cwd: webDir, detached: true, stdio: ["ignore", "ignore", "inherit"] });
process.on("exit", () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

// Counts view transitions and records each view-transition animation's duration, from the page's first script.
const probe = () => {
  window.__vt = { starts: 0, jacketMs: [], otherMs: [] };
  const orig = document.startViewTransition?.bind(document);
  if (orig)
    document.startViewTransition = (...a) => {
      window.__vt.starts++;
      const t = orig(...a);
      t.ready
        .then(() => {
          // goToStage's own .then on ready runs first, so these are the timings it set
          requestAnimationFrame(() => {
            for (const an of document.getAnimations()) {
              const pe = an.effect?.pseudoElement;
              if (!pe?.startsWith("::view-transition")) continue;
              const ms = an.effect.getComputedTiming().duration;
              (pe.includes("stage-jacket") && pe.startsWith("::view-transition-group") ? window.__vt.jacketMs : window.__vt.otherMs).push(ms);
            }
          });
        })
        .catch(() => {});
      return t;
    };
};

const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 120) throw new Error("server not ready after 60 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const fail = [];
  const report = [];
  for (const [w, h, motion] of [[1280, 720, "no-preference"], [1920, 1080, "no-preference"], [1280, 720, "reduce"]]) {
    const name = `${w}${motion === "reduce" ? "-reduce" : ""}`;
    const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: motion });
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.addInitScript(probe);
    await page.goto(base);
    await page.getByTestId("song-twinkle").focus();
    await page.waitForTimeout(300);
    const t0 = Date.now();
    await page.keyboard.press("Enter");
    if (motion !== "reduce") {
      await page.screenshot({ path: join(out, `${name}-0ms.png`) });
      await page.waitForTimeout(Math.max(0, 200 - (Date.now() - t0)));
      await page.screenshot({ path: join(out, `${name}-200ms.png`) });
    }
    await page.waitForURL(/\/play\?song=twinkle/, { timeout: 10_000 });
    await page.locator('section[aria-label="Stage"]').waitFor({ timeout: 10_000 });
    const waitMs = Date.now() - t0;
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(out, `${name}-settled.png`) });
    const vt = await page.evaluate(() => window.__vt);
    const f = [];
    if (motion === "reduce") {
      if (vt.starts !== 0) f.push(`${vt.starts} view transition(s) under reduced motion, want 0`);
    } else {
      if (vt.starts !== 1) f.push(`${vt.starts} view transitions, want 1`);
      if (!vt.jacketMs.length) f.push("no animation on ::view-transition-group(stage-jacket)");
      if (vt.jacketMs.some((ms) => ms > 400)) f.push(`jacket animation ${vt.jacketMs} ms, want ≤ 400`);
    }
    f.push(...errors);
    report.push({ name, waitMs, ...vt });
    say(`verify-move: ${name}: ${vt.starts} transition(s), jacket ${JSON.stringify(vt.jacketMs)} ms, stage card ${waitMs} ms after Enter${f.length ? ` FAIL ${f.join("; ")}` : ""}`);
    fail.push(...f.map((s) => `${name}: ${s}`));
    await page.close();
  }
  writeFileSync(join(out, "move.json"), JSON.stringify(report, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-move: pass, one view transition with the jacket moving ≤ 400 ms at 1280 and 1920, none under reduced motion (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-move: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
