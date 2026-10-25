// Headless proof of the replay view (spec: replay-view, the Chrome step): on /sim, the bot plays Twinkle through the fake
// piano; at the results, Watch replay draws the take on the highway while piano-out plays it to the fake piano's
// output. Each replayed note-on's send time must be within 20 ms of its marker crossing the judgment line. Esc closes.
// Usage: node web/src/game/dynamics/verify-replay.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-replay.mjs --out <dir>");
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
const url = `${base}/sim`;
say(`verify-replay: starting next dev on ${port}`);
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.getByRole("button", { name: "Watch the bot" }).click({ timeout: 60_000 });
  const game = page.frameLocator('iframe[data-testid="sim-game"]');
  await game.getByTestId("watch-replay").click({ timeout: 120_000 });
  const frame = page.frames().find((f) => f.url().includes("/play"));
  await frame.waitForFunction(() => (window.__replayView?.crossings.length ?? 0) >= 10, null, { timeout: 30_000 });
  await page.screenshot({ path: join(out, "replay-mid.png") });
  await frame.waitForFunction(() => !document.querySelector('[data-testid="replay-overlay"]'), null, { timeout: 120_000 });
  const { hook, sent } = await frame.evaluate(async () => {
    const access = await navigator.requestMIDIAccess(); // the sim's fake piano (it replaced requestMIDIAccess)
    const output = [...access.outputs.values()][0];
    return { hook: window.__replayView, sent: output.sent.map((m) => ({ bytes: [...m.data], at: m.timestamp })) };
  });
  // The replay's note-ons, after the replay started, in time order; the markers' crossings, in time order.
  const ons = sent.filter((m) => m.bytes[0] === 0x90 && m.bytes[2] > 0 && m.at >= hook.startPerf).sort((a, b) => a.at - b.at);
  const crossings = [...hook.crossings].sort((a, b) => a.atPerf - b.atPerf);
  const fail = [];
  if (!hook.sound) fail.push("the replay was silent: piano-out saw no piano");
  if (ons.length !== crossings.length) fail.push(`${ons.length} replayed note-ons, ${crossings.length} markers`);
  const gaps = ons.map((m, i) => ({ pitch: m.bytes[1], marker: crossings[i]?.pitch, ms: Math.abs(m.at - (crossings[i]?.atPerf ?? Infinity)), frameMs: Math.abs(m.at - (crossings[i]?.framePerf ?? Infinity)) }));
  const worst = Math.max(...gaps.map((g) => g.ms));
  const worstFrame = Math.max(...gaps.map((g) => g.frameMs));
  if (gaps.some((g) => g.pitch !== g.marker)) fail.push("a replayed note and its marker differ in pitch");
  if (worst > 20) fail.push(`a note was ${worst.toFixed(1)} ms from its marker's crossing`);
  say(`verify-replay: ${ons.length} replayed notes; send time vs marker crossing: max ${worst.toFixed(2)} ms (clock), max ${worstFrame.toFixed(1)} ms (first frame past the line)`);

  // Esc closes a second replay early. The replay is a modal dialog (#1245): Stop has focus while it's open, and focus
  // goes back to Watch replay after.
  const focused = () => frame.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null);
  await game.getByTestId("watch-replay").click();
  await page.waitForTimeout(1500);
  if ((await focused()) !== "replay-stop") fail.push(`Stop wasn't focused in the open replay (${await focused()})`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if (await game.getByTestId("replay-overlay").count()) fail.push("Esc didn't close the replay");
  else if ((await focused()) !== "watch-replay") fail.push(`focus didn't go back to Watch replay (${await focused()})`);
  fail.push(...errors);
  writeFileSync(join(out, "replay.json"), JSON.stringify({ gaps, hook }, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-replay: pass (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-replay: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
