// Headless proof of chord sync, the spec's Playwright check: Gymnopédie No. 1 (left-hand chords) played through
// window.__pianoArcade.press, every note on time except one left-hand chord spread over 45 ms. The results panel must
// list exactly that chord. Screenshot of the panel. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/chord-sync/verify-chords.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-chords.mjs --out <dir>");
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
const url = `http://localhost:${port}/play?song=gymnopedie-1&input=test&beat=off`;
say(`verify-chords: starting next dev on ${port}`);
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
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  // Chords: 2+ notes, one hand, one beat. Roll the second left-hand chord: its notes 0, 22.5, 45 ms late, low to high.
  const groups = new Map();
  chart.notes.forEach((n) => groups.set(`${n.hand}@${n.beat}`, [...(groups.get(`${n.hand}@${n.beat}`) ?? []), n]));
  const chords = [...groups.values()].filter((g) => g.length >= 2);
  const target = chords.filter((g) => g[0].hand === "L").sort((a, b) => a[0].beat - b[0].beat)[1];
  const late = new Map([...target].sort((a, b) => a.pitch - b.pitch).map((n, i, all) => [n.id, (45 * i) / (all.length - 1)]));
  await page.evaluate(
    ([notes, mpb, late]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb + (late[n.id] ?? 0))),
    [chart.notes, mpb, Object.fromEntries(late)],
  );
  await page.waitForSelector('[data-testid="chord-sync"]', { timeout: 120_000 });
  const panel = page.getByTestId("chord-sync");
  await panel.scrollIntoViewIfNeeded();
  const lines = (await panel.innerText()).split("\n").filter(Boolean);
  await page.waitForSelector('[data-testid="full-combo"]', { state: "detached", timeout: 5_000 }).catch(() => {}); // the 2 s banner
  await panel.screenshot({ path: join(out, "chord-sync-panel.png") });
  await page.screenshot({ path: join(out, "results.png") });

  const bar = Math.floor(target[0].beat / chart.beatsPerBar) + 1;
  const beat = Math.round(((target[0].beat % chart.beatsPerBar) + 1) * 100) / 100;
  const want = [`1 of ${chords.length} chords rolled`, `Bar ${bar}, beat ${beat}, left hand: 45 ms, low to high`];
  const fail = [];
  if (JSON.stringify(lines) !== JSON.stringify(want)) fail.push(`panel ${JSON.stringify(lines)}, want ${JSON.stringify(want)}`);
  fail.push(...errors);
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-chords: pass, the panel read ${JSON.stringify(lines)} (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-chords: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
