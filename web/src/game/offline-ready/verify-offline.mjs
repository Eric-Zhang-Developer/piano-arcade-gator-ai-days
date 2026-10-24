// Offline ready (spec: offline-ready): proves the game runs from the laptop with the venue's wifi off. Builds (online),
// serves the build with next start, and drives Chromium at 1280×720 with every request off loopback aborted and
// recorded. A canary fetch proves the block works first. Then the walk: / -> Enter -> /play's start screen -> a
// perfect bot take -> /sheet; a take with the browser fully offline after load; Saira loaded on / and /play.
// Exit 0: `verify-offline: pass, 0 off-machine requests`. Exit 1 lists every blocked URL and failed step.
// Usage: node web/src/game/offline-ready/verify-offline.mjs --out <dir> [--no-build]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-offline.mjs --out <dir> [--no-build]");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

if (!process.argv.includes("--no-build")) {
  say("verify-offline: next build (this step needs the network: next/font downloads Saira)");
  const b = spawnSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) {
    say("verify-offline: the build failed");
    process.exit(1);
  }
}
const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(webDir, "node_modules/.bin/next"), ["start", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
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

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const blocked = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
// Wifi off: loopback works, anything else is aborted and recorded.
await context.route("**/*", (route) => {
  const url = route.request().url();
  const { protocol, hostname } = new URL(url);
  if (!/^https?:$/.test(protocol) || LOOPBACK.has(hostname)) return route.continue();
  blocked.push(url);
  return route.abort();
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
for (let i = 0; ; i++) {
  try {
    await page.goto(`${base}/`);
    break;
  } catch (e) {
    if (i > 60) throw e;
    await page.waitForTimeout(1000); // the server is still starting
  }
}

// The canary: a broken route can't pass silently.
await page.evaluate(() => fetch("https://example.com/").catch(() => null));
if (!blocked.includes("https://example.com/")) {
  say("verify-offline: canary not blocked");
  process.exit(1);
}
blocked.length = 0;

const sairaLoaded = () => page.evaluate(() => [...document.fonts].some((f) => /saira/i.test(f.family) && f.status === "loaded"));
const results = async (p) => {
  await p.getByTestId("results").waitFor({ timeout: 120_000 });
  return Number(await p.getByTestId("count-PERFECT").textContent());
};

// The walk.
await page.locator("ol a").first().waitFor({ timeout: 30_000 });
check((await page.locator("ol a").count()) > 0, "/: the song list shows");
await page.evaluate(() => document.fonts.ready);
check(await sairaLoaded(), "/: Saira is loaded");
await page.screenshot({ path: join(out, "select.png") });
await page.locator("ol a").first().focus();
await page.keyboard.press("Enter");
await page.waitForURL(/\/play\?song=twinkle/, { timeout: 30_000 });
await page.getByRole("button", { name: "Start", exact: true }).waitFor({ timeout: 30_000 });
check(true, "Enter on the first card -> /play?song=twinkle's start screen");
await page.evaluate(() => document.fonts.ready);
check(await sairaLoaded(), "/play: Saira is loaded");

await page.goto(`${base}/play?song=twinkle&bot=perfect`);
await page.getByRole("button", { name: "Start", exact: true }).click({ timeout: 30_000 });
const perfect = await results(page);
check(perfect === 42, `bot=perfect take -> results with ${perfect} PERFECT (want 42)`);
await page.screenshot({ path: join(out, "results.png") });

await page.goto(`${base}/sheet?song=twinkle`);
const rendered = await page
  .waitForFunction(() => document.querySelectorAll("svg .vf-stavenote").length > 0, null, { timeout: 30_000 })
  .then(() => true)
  .catch(() => false);
check(rendered, "/sheet?song=twinkle: the score renders (OSMD's chunk from localhost)");

// Fully offline after load: nothing in the playing loop touches the network.
const off = await context.newPage();
off.on("pageerror", (e) => errors.push(e.message));
await off.goto(`${base}/play?song=twinkle&bot=perfect`);
const start = off.getByRole("button", { name: "Start", exact: true });
await start.waitFor({ timeout: 30_000 });
await context.setOffline(true);
await start.click();
const offPerfect = await results(off);
await context.setOffline(false);
check(offPerfect === 42, `fully offline after load: a take -> ${offPerfect} PERFECT (want 42)`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
for (const url of blocked) say(`blocked: ${url}`);
writeFileSync(join(out, "verify-offline.json"), JSON.stringify({ failures, blocked }, null, 2));
await browser.close();
const pass = failures.length === 0 && blocked.length === 0;
say(pass ? "verify-offline: pass, 0 off-machine requests" : `verify-offline: fail, ${blocked.length} off-machine requests, ${failures.length} failed steps`);
process.exit(pass ? 0 : 1);
