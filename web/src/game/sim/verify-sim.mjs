// Headless proof of the MIDI path: /play?midi=sim, the bot plays Twinkle as raw bytes through the fake piano and
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  // A second page on the same origin plays the /sim side of the channel.
  const control = await context.newPage();
  await control.goto(`${base}/`);
  await control.evaluate(() => {
    window.__sim = [];
    window.__ch = new BroadcastChannel("pianoArcade.sim");
    window.__ch.onmessage = (e) => e.data.simId === "verify" && window.__sim.push(e.data);
  });
  const game = await context.newPage();
  const errors = [];
  game.on("pageerror", (e) => errors.push(e.message));
  await game.goto(`${base}/play?midi=sim&simId=verify`);
  await control.waitForFunction(() => window.__sim.some((m) => m.type === "ready"), null, { timeout: 60_000 });
  await control.evaluate(() => window.__ch.postMessage({ simId: "verify", type: "bot" }));
  say("verify-sim: bot armed, game started");

  await game.waitForSelector('[data-testid="results"]', { timeout: 90_000 });
  await game.screenshot({ path: join(out, "results.png") });
  const dom = {};
  for (const k of ["PERFECT", "GREAT", "MISS", "extra"]) dom[k] = Number(await game.textContent(`[data-testid="count-${k}"]`));
  const status = await game.textContent("main");
  const logged = await control.evaluate(() => window.__sim.filter((m) => m.type === "log" && m.log.kind === "message").length);
  writeFileSync(join(out, "results.json"), JSON.stringify({ dom, logged, errors }, null, 2));

  const n = (await (await fetch(`${base}/songs/twinkle/chart.json`)).json()).notes.length;
  if (dom.PERFECT !== n || dom.MISS || dom.extra) fail.push(`screen ${JSON.stringify(dom)}, want ${n} PERFECT`);
  if (logged !== 2 * n) fail.push(`fake delivered ${logged} messages, want ${2 * n} (on + release per note)`);
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
