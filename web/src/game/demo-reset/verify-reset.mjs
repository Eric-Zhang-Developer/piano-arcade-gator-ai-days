// Headless proof of demo reset (spec: demo-reset), with a stand-in "Portable Grand" that records every send:
//   1. latency 37 on /play; Shift+Esc mid-take -> /, All Notes Off on all 16 channels, and /play still shows 37 ms.
//   2. ?idle=3 results, no input -> / within 5 s; a key at 2 s -> still on the results at 4 s.
//   3. ?cabinet=1&idle=3 -> still on the results at 5 s.
//   4. ?idle=3, Replay on piano -> still on the results while it plays past 3 s, then / within 5 s of its end.
//   5. Esc alone mid-take -> the pause menu, still on /play.
// Usage: node web/src/game/demo-reset/verify-reset.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-reset.mjs --out <dir>");
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
say(`verify-reset: starting next dev on ${port}`);
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

// verify-cabinet's stand-in piano, minus the echo. Sends go to the test through a binding, so they survive the reset's
// page load.
const fakePiano = () => {
  const input = new EventTarget();
  input.name = "Digital Piano Portable Grand";
  input.onmidimessage = null;
  class FakeOutput {
    name = "Digital Piano Portable Grand";
    send(m) {
      window.__record?.([...m]);
    }
    clear() {}
  }
  window.MIDIOutput = FakeOutput;
  const access = Object.assign(new EventTarget(), { inputs: new Map([["in", input]]), outputs: new Map([["out", new FakeOutput()]]) });
  navigator.requestMIDIAccess = () => Promise.resolve(access);
};

const browser = await chromium.launch({ headless: true });
const errors = [];
let sent = [];
const fresh = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("__record", (m) => sent.push(m));
  await page.addInitScript(fakePiano);
  return page;
};
async function goto(page, path) {
  for (let i = 0; ; i++) {
    try {
      return await page.goto(`${base}${path}`);
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}
const start = (page) => page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves
const results = (page) => page.getByTestId("results").waitFor({ timeout: 120_000 });
const atHome = (page) => new URL(page.url()).pathname === "/";
const twinkle = "/play?song=twinkle&bot=perfect&beat=off";

try {
  // 1. Shift+Esc mid-take.
  let page = await fresh();
  await goto(page, "/play?song=twinkle");
  await page.locator('input[type="range"]').first().fill("37");
  await goto(page, twinkle);
  await start(page);
  await page.waitForTimeout(6000);
  sent = [];
  await page.keyboard.press("Shift+Escape");
  await page.waitForURL(`${base}/`, { timeout: 10_000 }).catch(() => {});
  check(atHome(page), `Shift+Esc mid-take -> ${new URL(page.url()).pathname}`);
  const offs = new Set(sent.filter((m) => (m[0] & 0xf0) === 0xb0 && m[1] === 123 && m[2] === 0).map((m) => m[0] & 0x0f));
  check(offs.size === 16, `All Notes Off on ${offs.size} of 16 channels`);
  await page.screenshot({ path: join(out, "1-reset-home.png") });
  await goto(page, "/play?song=twinkle");
  const latency = await page.locator("label output").first().innerText({ timeout: 30_000 });
  check(latency === "37 ms", `the latency offset survives: ${latency}`);
  await page.close();

  // 2. Idle on the results.
  page = await fresh();
  await goto(page, `${twinkle}&idle=3`);
  await start(page);
  await results(page);
  let t0 = Date.now();
  await page.waitForURL(`${base}/`, { timeout: 5_000 }).catch(() => {});
  check(atHome(page), `no input on the results -> / after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await goto(page, `${twinkle}&idle=3`);
  await start(page);
  await results(page);
  await page.waitForTimeout(2000);
  await page.keyboard.press("Shift");
  await page.waitForTimeout(2000);
  check(!atHome(page), "a key at 2 s -> still on the results at 4 s");
  await page.close();

  // 3. A cabinet take keeps cabinet's own 30 s return.
  page = await fresh();
  await goto(page, `${twinkle}&cabinet=1&idle=3`);
  await start(page);
  await results(page);
  await page.waitForTimeout(5000);
  check(!atHome(page), "?cabinet=1 -> still on the results at 5 s");
  await page.close();

  // 4. Replay on piano holds the wait.
  page = await fresh();
  await goto(page, `${twinkle}&idle=3`);
  await start(page);
  await results(page);
  await page.getByTestId("replay").click({ timeout: 10_000 });
  await page.waitForTimeout(5000);
  check(!atHome(page), "Replay on piano -> still on the results 5 s into the replay");
  await page.getByTestId("replay").waitFor({ timeout: 90_000 }); // Stop turns back into Replay at its end
  t0 = Date.now();
  await page.waitForURL(`${base}/`, { timeout: 5_000 }).catch(() => {});
  check(atHome(page), `after the replay -> / ${((Date.now() - t0) / 1000).toFixed(1)} s after its end`);
  await page.close();

  // 5. Esc alone is the pause menu.
  page = await fresh();
  await goto(page, twinkle);
  await start(page);
  await page.waitForTimeout(6000);
  await page.keyboard.press("Escape");
  const paused = await page.getByTestId("pause").waitFor({ timeout: 5_000 }).then(() => true, () => false);
  check(paused && new URL(page.url()).pathname === "/play", `Esc alone -> the pause menu on ${new URL(page.url()).pathname}`);
  await page.screenshot({ path: join(out, "5-esc-pause.png") });
  await page.close();

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} catch (e) {
  check(false, `threw: ${e.message}`);
} finally {
  await browser.close();
}
writeFileSync(join(out, "reset.json"), JSON.stringify({ failures }, null, 2));
say(failures.length ? `verify-reset: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-reset: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
