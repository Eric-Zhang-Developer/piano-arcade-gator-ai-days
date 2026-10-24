// Headless proof of note labels, the spec's Chrome steps: /play with no MIDI shows laptop letters (auto),
// ?labels=notes letter names, ?labels=off nothing; the start screen's toggle cycles the setting. A screenshot of
// each, mid-song on Twinkle. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/note-labels/verify-labels.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-labels.mjs --out <dir>");
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
say(`verify-labels: starting next dev on ${port}`);
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
  for (const [name, query, want] of [
    ["auto", "", { setting: "auto", mode: "keys" }],
    ["notes", "&labels=notes", { setting: "notes", mode: "notes" }],
    ["off", "&labels=off", { setting: "off", mode: "off" }],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${base}/play?song=twinkle&input=test&beat=off${query}`);
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    const chart = await page.evaluate(() => window.__pianoArcade.chart);
    const mpb = 60000 / chart.bpm;
    await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
    await page.waitForTimeout(6500); // count-in done, a few notes falling
    await page.screenshot({ path: join(out, `labels-${name}.png`) });
    const got = await page.evaluate(() => window.__pianoArcadeLabels);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail.push(`${name}: ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    fail.push(...errors.map((e) => `${name}: ${e}`));
    await page.close();
  }

  // The start screen's toggle: Auto -> Note names, remembered for the next visit.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/play?song=twinkle&beat=off`);
  const toggle = page.getByTestId("labels-toggle");
  const before = await toggle.textContent({ timeout: 60_000 });
  await toggle.click();
  const after = await toggle.textContent();
  const stored = await page.evaluate(() => localStorage.getItem("pianoArcade.labels"));
  await page.screenshot({ path: join(out, "start-toggle.png") });
  if (before !== "Labels: Auto" || after !== "Labels: Note names" || stored !== "notes") fail.push(`toggle: "${before}" -> "${after}", stored ${stored}`);

  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-labels: pass, auto shows laptop letters without MIDI, ?labels=notes and off work, the toggle went "${before}" -> "${after}" (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-labels: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
