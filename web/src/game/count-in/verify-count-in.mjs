// Headless proof of the count-in (spec: count-in, Validation c), from the page's own frame log
// (window.__pianoArcadeCountIn) and beat-track's count-in clicks (window.__pianoArcadeBeat):
// 1. /play?song=twinkle&bot=perfect&input=test: each beat shows on the first frame at or after its time, at most one
//    frame late, and each click is scheduled within one frame of that frame. No console error.
// 2. Start, Esc on beat 3, Enter: after the resume every frame's numeral is the one its clock says; nothing stray.
// 3. Reduced motion: each numeral is whole (alpha 1, scale 1) on its first frame.
// Usage: node web/src/game/count-in/verify-count-in.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-count-in.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const FRAME_MS = 1000 / 60;
const SLACK_MS = 1; // timer rounding in performance.now()

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-count-in: starting next dev on ${port}`);
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

// The numeral a frame should show, from its clock: the count half's beats count 4 3 2 1.
const expected = (beats, nowMs) => {
  if (nowMs >= 0) return null;
  let i = -1;
  while (i + 1 < beats.length && beats[i + 1] <= nowMs) i++;
  const half = beats.length / 2;
  return i >= half ? String(beats.length - i) : null;
};

const browser = await chromium.launch({ headless: true });
const fail = [];
const check = (ok, line) => {
  say(`${ok ? "ok" : "FAIL"}: ${line}`);
  if (!ok) fail.push(line);
};
const open = async (query, opts = {}) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  await page.goto(`${base}/play?${query}`);
  return { page, errors };
};
const finished = (page) => page.waitForFunction(() => (window.__pianoArcadeCountIn?.frames ?? []).some((f) => f.nowMs >= 0), null, { timeout: 60_000 });

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

  // 1. Each beat's first frame and its click.
  {
    const { page, errors } = await open("song=twinkle&bot=perfect&input=test");
    await finished(page);
    const { beats, frames } = await page.evaluate(() => window.__pianoArcadeCountIn);
    const clicks = await page.evaluate(() => window.__pianoArcadeBeat?.countIn ?? []);
    writeFileSync(join(out, "frames.json"), JSON.stringify({ beats, frames, clicks }, null, 1));
    check(beats.length === 8, `8 count-in beats (${beats.length})`);
    check(clicks.length === 8, `8 count-in clicks scheduled (${clicks.length})`);
    const rows = [];
    beats.forEach((atMs, k) => {
      const at = frames.findIndex((f) => f.nowMs >= atMs);
      const f = frames[at];
      if (!f) return check(false, `beat ${k + 1}: no frame at or after ${atMs}`);
      const prev = frames[at - 1];
      const late = f.nowMs - atMs;
      const gap = prev ? f.nowMs - prev.nowMs : 0; // the browser's own frame step here
      const click = clicks.find((c) => Math.abs(c.atMs - atMs) < 0.5);
      const clickOff = click ? f.perfMs - (click.perfMs + late) : NaN; // 0 when the click and the drawn clock agree
      rows.push(`beat ${k + 1}: frame +${late.toFixed(1)} ms, click ${click ? `${(f.perfMs - click.perfMs).toFixed(1)} ms before it` : "missing"}`);
      check(f.beat === k + 1, `beat ${k + 1} shows on its first frame (it shows beat ${f.beat})`);
      check(late <= Math.max(FRAME_MS, gap) + SLACK_MS, `beat ${k + 1}: first frame ${late.toFixed(1)} ms late (frame step ${gap.toFixed(1)} ms)`);
      check(Math.abs(clickOff) <= FRAME_MS, `beat ${k + 1}: click within a frame of its frame (${Number.isNaN(clickOff) ? "no click" : `${clickOff.toFixed(1)} ms`})`);
    });
    say(rows.join("\n"));
    check(frames.some((f) => f.hot), "beat 0 has its white-hot frame");
    await page.screenshot({ path: join(out, "first-note.png") });
    check(errors.length === 0, `no console error (${errors.join("; ") || "none"})`);
    await page.close();
  }

  // 2. Pause on beat 3, resume: no stray numeral.
  {
    const { page, errors } = await open("song=twinkle&bot=perfect");
    const playAnyway = page.getByRole("button", { name: /play anyway/i });
    if (await playAnyway.isVisible().catch(() => false)) await playAnyway.click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.waitForFunction(() => (window.__pianoArcadeCountIn?.frames ?? []).some((f) => f.beat === 3), null, { timeout: 60_000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, "paused-beat3.png") });
    const before = await page.evaluate(() => window.__pianoArcadeCountIn.frames.length);
    await page.keyboard.press("Enter"); // Resume has the focus
    await finished(page);
    const { beats, frames } = await page.evaluate(() => window.__pianoArcadeCountIn);
    const after = frames.slice(before);
    const stray = after.filter((f) => f.nowMs < 0 && f.numeral !== expected(beats, f.nowMs));
    check(after.length > 0, `frames after the resume (${after.length})`);
    check(stray.length === 0, `after the resume every numeral matches its clock (${stray.length} stray)`);
    check(errors.length === 0, `no console error (${errors.join("; ") || "none"})`);
    await page.close();
  }

  // 3. Reduced motion: numerals whole on their first frame.
  {
    const { page, errors } = await open("song=twinkle&bot=perfect&input=test", { reduced: true });
    await finished(page);
    const { frames } = await page.evaluate(() => window.__pianoArcadeCountIn);
    for (const n of ["4", "3", "2", "1"]) {
      const f = frames.find((fr) => fr.numeral === n);
      check(!!f && f.alpha === 1 && f.scale === 1, `reduced motion: ${n} whole on its first frame (${f ? `alpha ${f.alpha}, scale ${f.scale}` : "never shown"})`);
    }
    check(errors.length === 0, `no console error (${errors.join("; ") || "none"})`);
    await page.close();
  }

  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-count-in: pass (evidence: ${out})`);
} catch (e) {
  console.error(`verify-count-in: FAIL: ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
process.exit(process.exitCode ?? 0);
