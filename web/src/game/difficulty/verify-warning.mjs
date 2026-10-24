// Headless proof of the WARNING card: Moonlight (Lv 14) shows it in the count-in's first bar and drops it after;
// Twinkle shows it only with ?warn=1. Screenshots of each. ?beat=off keeps the laptop click out of it.
// Usage: node web/src/game/difficulty/verify-warning.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-warning.mjs --out <dir>");
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
say(`verify-warning: starting next dev on ${port}`);
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
    ["moonlight", "song=moonlight-3", { level: 14, show: true }],
    ["twinkle", "song=twinkle", { level: 1, show: false }],
    ["twinkle-warn", "song=twinkle&warn=1", { level: 1, show: true }],
  ]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${base}/play?${query}&input=test&beat=off`);
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    const got = await page.evaluate(() => window.__pianoArcadeWarning);
    if (JSON.stringify(got) !== JSON.stringify(want)) fail.push(`${name}: ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    await page.waitForTimeout(700); // inside the first bar (2.4 s at Twinkle's 100 BPM)
    await page.screenshot({ path: join(out, `${name}-first-bar.png`) });
    if (want.show) {
      await page.waitForTimeout(4000); // past the first bar at Moonlight's tempo too
      await page.screenshot({ path: join(out, `${name}-after.png`) });
    }
    fail.push(...errors.map((e) => `${name}: ${e}`));
    await page.close();
  }
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-warning: pass, Moonlight Lv 14 warns, Twinkle Lv 1 doesn't unless ?warn=1 (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-warning: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
