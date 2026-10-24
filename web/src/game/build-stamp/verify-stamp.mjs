// Headless proof of the build stamp (spec: build-stamp): / shows `git rev-parse --short HEAD` in the stamp and covers
// no song card or the focused song at 1280×720 and 1920×1080; /?capture=1 hides it after hydration. Screenshots of /
// at both sizes. Runs its own `next dev`.
// Usage: node web/src/game/build-stamp/verify-stamp.mjs --out <dir>
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-stamp.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: webDir, encoding: "utf8" }).trim();

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-stamp: starting next dev on ${port}`);
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
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(base);
    const stamp = page.getByTestId("build-stamp");
    await page.waitForFunction(() => /old/.test(document.querySelector('[data-testid="build-stamp"]')?.textContent ?? ""), null, { timeout: 30_000 });
    const text = await stamp.textContent();
    const box = await stamp.boundingBox();
    const covered = await page.evaluate((b) => {
      const hit = [];
      for (const el of document.querySelectorAll('[data-testid^="song-"], section[aria-live]')) {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) continue; // scrolled out of view
        if (b.x < r.right && r.left < b.x + b.width && b.y < r.bottom && r.top < b.y + b.height) hit.push(el.getAttribute("data-testid") ?? "focus");
      }
      return hit;
    }, box);
    await page.screenshot({ path: join(out, `stamp-${w}.png`) });
    const f = [];
    if (!text?.startsWith(`${head} · `)) f.push(`stamp "${text}", want ${head} · …`);
    if (covered.length) f.push(`stamp covers ${covered.join(", ")}`);
    f.push(...errors);
    say(`verify-stamp: ${w}×${h}: "${text}" at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}${f.length ? ` FAIL ${f.join("; ")}` : ""}`);
    fail.push(...f.map((s) => `${w}: ${s}`));
    await page.close();
  }
  const cap = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await cap.goto(`${base}/?capture=1`);
  await cap.waitForFunction(() => document.documentElement.hasAttribute("data-capture"), null, { timeout: 30_000 });
  if (await cap.getByTestId("build-stamp").isVisible()) fail.push("?capture=1: the stamp is still visible");
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-stamp: pass, / shows ${head} with its age at 1280 and 1920, clear of the songs; ?capture=1 hides it (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-stamp: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
