// Headless proof of the MIDI path: /sim's "Watch the bot" plays Twinkle as raw bytes through the fake piano and
// core's real MIDI input, and every note must judge PERFECT. Web MIDI itself is never touched, so it runs headless.
// Usage: node web/src/game/sim/verify-sim.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-sim.mjs --out <dir>");
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
say(`verify-sim: starting next dev on ${port}`);
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
for (let end = Date.now() + 120_000; ; ) {
  if (Date.now() > end) throw new Error("server not ready after 120 s");
  if (await fetch(`${base}/play`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const browser = await chromium.launch({ headless: true });
const fail = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}/sim`);
  const bot = page.getByRole("button", { name: "Watch the bot" });
  await bot.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Watch the bot" && !b.disabled), null, { timeout: 60_000 });
  await bot.click();
  say("verify-sim: clicked Watch the bot on /sim");

  const game = page.frameLocator('iframe[title="game"]');
  await game.locator('[data-testid="results"]').waitFor({ timeout: 90_000 });
  await page.screenshot({ path: join(out, "sim-results.png") });
  const dom = {};
  for (const k of ["PERFECT", "GREAT", "MISS", "extra"]) dom[k] = Number(await game.locator(`[data-testid="count-${k}"]`).textContent());
  const status = await game.locator("main").textContent();
  const types = await page.locator('[data-testid="midi-log"] tbody tr td:nth-child(4)').allTextContents();
  const logged = types.filter((t) => t === "note_on" || t === "release(v0)").length;
  writeFileSync(join(out, "results.json"), JSON.stringify({ dom, logged, errors }, null, 2));

  const n = (await (await fetch(`${base}/songs/twinkle/chart.json`)).json()).notes.length;
  if (dom.PERFECT !== n || dom.MISS || dom.extra) fail.push(`screen ${JSON.stringify(dom)}, want ${n} PERFECT`);
  if (logged !== 2 * n) fail.push(`/sim log shows ${logged} key messages, want ${2 * n} (on + release per note)`);
  if (!status?.includes("MIDI: Portable Grand")) fail.push("game didn't pick the fake Portable Grand");
  if (errors.length) fail.push(`page errors: ${errors.join("; ")}`);
  if (!fail.length) say(`verify-sim: pass, ${n}/${n} PERFECT through the MIDI path (evidence: ${out})`);
} finally {
  await browser.close();
}
if (fail.length) {
  console.error(`verify-sim: FAIL: ${fail.join("; ")}`);
  process.exit(1);
}
process.exit(0);
