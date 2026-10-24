// Browser proof of key-preview (spec: key-preview, Validation): next dev, headless Chromium with reduced motion (the
// hit line holds still), 1280×720.
// 1. /play?song=twinkle&mode=wait&input=test, no presses: the clock holds at the first note (C4). lit has pitch 60 at
//    peakAlpha and no 67 (G4 is 1.2 s away).
// 2. The same with &keypreview=0: lit is empty.
// 3. A screenshot of each: in the bottom quarter of C4's rect the pixel differs from run 2's by at least 20 in some
//    channel, and G4's by at most 6.
// 4. Ode to Joy (both hands) mid-take at 1280×720 and 1920×1080, every note pressed on time: screenshots.
// Usage: node web/src/game/key-preview/verify-key-preview.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PEAK = 0.35; // keyPreviewSettings.peakAlpha
const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-key-preview.mjs --out <dir>");
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
say(`verify-key-preview: next dev on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
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
    if ((await fetch(base)).ok) break;
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
const browser = await chromium.launch({ headless: true });
const errors = [];
const chartAt = (page, ms) => page.waitForFunction((t) => (window.__pianoArcade?.now?.() ?? -Infinity) >= t, ms, { timeout: 60_000, polling: 5 });

// Twinkle in wait mode, no presses: the clock holds at C4's time (0). Returns the hook's lit keys and a screenshot.
async function held(query, shot) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${shot}: ${e.message}`));
  await page.goto(`${base}/play?song=twinkle&mode=wait&input=test${query}`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 90_000 });
  await chartAt(page, 0);
  await page.waitForTimeout(300); // held: a few frames at the same chart time, well before wait-hint's 3 s
  const lit = await page.evaluate(() => window.__pianoArcadeKeyPreview?.lit ?? null);
  const now = await page.evaluate(() => window.__pianoArcade.now());
  const path = join(out, shot);
  await page.screenshot({ path });
  await context.close();
  return { lit, now, png: readFileSync(path) };
}

// Pixels of a PNG, decoded by the browser: [r, g, b] at each point.
async function pixels(png, points) {
  const page = await browser.newPage();
  const px = await page.evaluate(
    async ({ b64, points }) => {
      const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const c = new OffscreenCanvas(img.width, img.height).getContext("2d");
      c.drawImage(img, 0, 0);
      return points.map(([x, y]) => [...c.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)]);
    },
    { b64: png.toString("base64"), points },
  );
  await page.close();
  return px;
}

// 1, 2
const on = await held("", "twinkle-held.png");
const off = await held("&keypreview=0", "twinkle-held-off.png");
const c4 = on.lit?.find((k) => k.pitch === 60);
check(c4 && Math.abs(c4.alpha - PEAK) < 1e-9, `1: held at ${Math.round(on.now)} ms, C4 (60) lit at peakAlpha (${c4?.alpha})`);
check(on.lit && !on.lit.some((k) => k.pitch === 67), `1: G4 (67) isn't lit (${on.lit?.map((k) => k.pitch).join(",")})`);
check(Array.isArray(off.lit) && off.lit.length === 0, `2: &keypreview=0 -> lit is empty (${JSON.stringify(off.lit)})`);

// 3: C4's bottom quarter, and G4's, four white keys to the right (C D E F G).
if (c4) {
  // Left of centre and at the top of the bottom quarter: note-labels draws the key's letter at its bottom centre.
  const white = c4.w + 1;
  const at = [
    [c4.x + c4.w * 0.25, c4.y + c4.h * 0.78],
    [c4.x - 0.5 + 4 * white + white * 0.25, c4.y + c4.h * 0.78],
  ];
  const [[c4On, g4On], [c4Off, g4Off]] = [await pixels(on.png, at), await pixels(off.png, at)];
  const diff = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  check(diff(c4On, c4Off) >= 20, `3: C4's pixel differs from the off run by ${diff(c4On, c4Off)} (>= 20): ${c4On} vs ${c4Off}`);
  check(diff(g4On, g4Off) <= 6, `3: G4's pixel differs by ${diff(g4On, g4Off)} (<= 6): ${g4On} vs ${g4Off}`);
}

// 4
for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`ode ${w}: ${e.message}`));
  await page.goto(`${base}/play?song=ode-to-joy&input=test`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 90_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  // Mid-take, 250 ms before a beat that has both hands' notes, when several keys are lit.
  const both = chart.notes.find((n) => n.hand === "L" && n.beat >= 8 && chart.notes.some((m) => m.hand === "R" && m.beat === n.beat));
  const shotMs = (both ? both.beat : 8) * mpb - 250;
  await chartAt(page, shotMs);
  const lit = await page.evaluate(() => window.__pianoArcadeKeyPreview?.lit ?? []);
  await page.screenshot({ path: join(out, `ode-${w}x${h}.png`) });
  check(lit.length > 0, `4: Ode to Joy at ${w}x${h}, ${Math.round(shotMs)} ms: ${lit.length} key(s) lit (${lit.map((k) => k.pitch).join(",")})`);
  await context.close();
}

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-key-preview.json"), JSON.stringify({ failures }, null, 2));
await browser.close();
say(`verify-key-preview: screenshots in ${out}`);
say(failures.length ? `verify-key-preview: ${failures.length} failed` : "verify-key-preview: pass");
process.exit(failures.length ? 1 : 0);
