// Verify: start the app, play Twinkle headless as the Perfect player, fail unless every note is PERFECT. Twice: with
// the test input, then on /sim through the MIDI path (raw bytes from the fake piano into core's real MIDI input).
// Usage: pnpm -C web verify --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });

const say = (s) => process.stdout.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer().once("error", rej);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

let server;
let browser;
function cleanup() {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

async function waitFor(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error(`server not ready at ${url} after ${timeoutMs / 1000} s`);
}

async function main() {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const url = `${base}/play?input=test`;
  say(`verify: starting next dev on ${port}`);
  server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
    cwd: webDir,
    detached: true,
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitFor(url, 120_000);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleLines = [];
  page.on("console", (m) => m.type() === "error" && consoleLines.push(`console.error: ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`pageerror: ${e.message}`));

  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    const chart = await page.evaluate(() => window.__pianoArcade.chart);
    const msPerBeat = 60000 / chart.bpm;
    await page.evaluate(
      ([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)),
      [chart.notes, msPerBeat],
    );
    const lastBeat = Math.max(...chart.notes.map((n) => n.beat + n.duration));
    say(`verify: queued ${chart.notes.length} notes, song ~${Math.round((lastBeat * msPerBeat) / 1000)} s`);

    await page.waitForSelector('[data-testid="results"]', { timeout: lastBeat * msPerBeat + 30_000 });
    const dom = {};
    for (const k of ["PERFECT", "GREAT", "MISS", "extra"]) {
      dom[k] = Number(await page.textContent(`[data-testid="count-${k}"]`));
    }
    const results = await page.evaluate(() => window.__pianoArcade.results);
    await page.screenshot({ path: join(out, "results.png"), fullPage: true });
    writeFileSync(join(out, "results.json"), JSON.stringify({ dom, results }, null, 2));

    const n = chart.notes.length;
    const fail = [];
    if (dom.PERFECT !== n) fail.push(`screen PERFECT ${dom.PERFECT}/${n}`);
    if (dom.MISS !== 0) fail.push(`screen MISS ${dom.MISS}`);
    if (dom.extra !== 0) fail.push(`screen extras ${dom.extra}`);
    if (results?.counts?.PERFECT !== n) fail.push(`results PERFECT ${results?.counts?.PERFECT}/${n}`);
    if (results?.counts?.MISS !== 0 || results?.counts?.extra !== 0) fail.push("results has MISS or extras");
    if (fail.length) throw new Error(fail.join("; "));
    say(`verify: test input pass, ${n}/${n} PERFECT`);

    await page.goto(`${base}/sim`);
    await page.getByRole("button", { name: "Watch the bot" }).click({ timeout: 60_000 }); // enabled once the game is ready
    const game = page.frameLocator('iframe[title="game"]');
    await game.locator('[data-testid="results"]').waitFor({ timeout: lastBeat * msPerBeat + 30_000 });
    const sim = {};
    for (const k of ["PERFECT", "GREAT", "MISS", "extra"]) {
      sim[k] = Number(await game.locator(`[data-testid="count-${k}"]`).textContent());
    }
    const midiStatus = await game.locator("main").textContent();
    const types = await page.locator('[data-testid="midi-log"] tbody tr td:nth-child(4)').allTextContents();
    const keyMessages = types.filter((t) => t === "note_on" || t === "release(v0)").length;
    await page.screenshot({ path: join(out, "sim-results.png") });
    writeFileSync(join(out, "sim-results.json"), JSON.stringify({ dom: sim, keyMessages }, null, 2));

    if (sim.PERFECT !== n || sim.MISS !== 0 || sim.extra !== 0) fail.push(`/sim screen ${JSON.stringify(sim)}, want ${n} PERFECT`);
    if (!midiStatus?.includes("MIDI: Portable Grand")) fail.push("/sim: the game didn't pick the fake Portable Grand");
    if (keyMessages !== 2 * n) fail.push(`/sim log shows ${keyMessages} key messages, want ${2 * n}`);
    if (fail.length) throw new Error(fail.join("; "));
    say(`verify: pass, ${n}/${n} PERFECT with test input and through the MIDI path on /sim (evidence: ${out})`);
  } catch (e) {
    await page.screenshot({ path: join(out, "failure.png"), fullPage: true }).catch(() => {});
    throw e;
  } finally {
    writeFileSync(join(out, "console.log"), consoleLines.join("\n") + "\n");
    await browser.close();
  }
}

main().then(
  () => process.exit(0),
  async (e) => {
    console.error(`verify: FAIL: ${e.message}`);
    await browser?.close().catch(() => {});
    process.exit(1);
  },
);
