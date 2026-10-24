// Headless proof of the wait hint (spec: wait-hint, the Chrome steps) on /play?song=twinkle&mode=wait&midi=sim: no hint
// 2.5 s into a hold and no note-on on the stand-in DGX; at 3.5 s the hint names the note and the DGX got exactly one
// note-on of it, still one at 6 s; pressing it clears the hint, and the next note's hint comes 3 s into its own hold.
// Screenshots at 1280×720 and 1920×1080, and with reduced motion: before (2.5 s in, nothing drawn yet) and the hint.
// Usage: node web/src/game/wait-hint/verify-wait-hint.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-wait-hint.mjs --out <dir>");
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
say(`verify-wait-hint: starting next dev on ${port}`);
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
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

async function open(page) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/play?song=twinkle&mode=wait&midi=sim&input=test&beat=off&stage=off`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  return page.evaluate(() => window.__pianoArcade.chart);
}
// Note-ons the stand-in DGX received (channel 1, velocity above 0).
const noteOns = (page) =>
  page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess();
    return [...access.outputs.values()].flatMap((o) => (o.sent ?? []).map((s) => [...s.data])).filter((d) => d[0] === 0x90 && d[2] > 0);
  });
const hint = (page) => page.evaluate(() => window.__pianoArcadeWaitHint ?? null);
// Waits until the chart clock reaches ms (it holds there in wait mode), and returns the wall time it did.
async function holdAt(page, ms) {
  await page.waitForFunction((t) => window.__pianoArcade.now() >= t, ms, { timeout: 60_000 });
  return Date.now();
}
const at = async (page, t0, ms) => page.waitForTimeout(Math.max(0, t0 + ms - Date.now()));

const browser = await chromium.launch({ headless: true });
const errors = [];
const shots = [
  [{ width: 1280, height: 720 }, "no-preference", true],
  [{ width: 1920, height: 1080 }, "no-preference", false],
  [{ width: 1920, height: 1080 }, "reduce", false],
];
for (const [viewport, reducedMotion, full] of shots) {
  const page = await browser.newPage({ viewport, reducedMotion });
  page.on("pageerror", (e) => errors.push(e.message));
  const chart = await open(page);
  const mpb = 60000 / chart.bpm;
  const notes = [...chart.notes].sort((a, b) => a.beat - b.beat);
  const [first, second] = notes;
  const name = (p) => NAMES[p % 12] + (p % 12 === 0 ? Math.floor(p / 12) - 1 : "");
  const tag = `${viewport.width}x${viewport.height}${reducedMotion === "reduce" ? "-reduced" : ""}`;

  // 1. 2.5 s into the first hold: nothing yet.
  let t0 = await holdAt(page, first.beat * mpb);
  await at(page, t0, 2500);
  await page.screenshot({ path: join(out, `before-${tag}.png`) }); // no hint yet: the screen as main draws it
  if (full) {
    check((await hint(page)) === null, "2.5 s into the first hold: no hint");
    check((await noteOns(page)).length === 0, "2.5 s in: the DGX got no note-on");
  }
  // 2. At 3.5 s: the hint names the note, and the DGX played it once.
  await at(page, t0, 3500);
  const h = await hint(page);
  await page.screenshot({ path: join(out, `hint-${tag}.png`) });
  check(h?.pitches?.join() === String(first.pitch) && h.name === name(first.pitch), `${tag}: at 3.5 s the hint is ${JSON.stringify(h)}`);
  if (full) {
    let ons = await noteOns(page);
    check(ons.length === 1 && ons[0][1] === first.pitch, `at 3.5 s the DGX got one note-on of ${first.pitch} (${JSON.stringify(ons)})`);
    await at(page, t0, 6000);
    ons = await noteOns(page);
    check(ons.length === 1, `at 6 s, still one (${ons.length})`);

    // 3. Press it: the hint clears; the next note's hint comes 3 s into its own hold.
    await page.evaluate(([p, t]) => window.__pianoArcade.press(p, t), [first.pitch, first.beat * mpb]);
    await page.waitForTimeout(100);
    check((await hint(page)) === null, "pressed: no hint");
    t0 = await holdAt(page, second.beat * mpb);
    await at(page, t0, 2500);
    check((await hint(page)) === null, "the next note, 2.5 s in: no hint");
    await at(page, t0, 3500);
    const h2 = await hint(page);
    check(h2?.pitches?.join() === String(second.pitch), `the next note at 3.5 s: ${JSON.stringify(h2)}`);
  }
  await page.close();
}
await browser.close();
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-wait-hint: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-wait-hint: pass (evidence: ${out})`);
process.exit(0);
