// Headless proof of the Duo HUD (spec: duo-hud, Validation 2). Starts its own dev server; prints `verify-hud: pass`
// and exits 0, or names each failed step and exits 1:
// 1. /play?song=fur-elise&bot=perfect, Start, at 1280×720: the HUD's test hook (window.__pianoArcadeHud) reports
//    `bar` rising from 1 to its `bars` (N), never down, and `combo` rising.
// 2. Screenshots hud-mid.png about 20 s in, at 1280×720 and 1920×1080, plus hud-reduced.png (reduced motion).
// Usage: node web/src/game/duo-hud/verify-hud.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-hud.mjs --out <dir>");
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
say(`verify-hud: starting next dev on ${port}`);
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

const PATH = "/play?song=fur-elise&bot=perfect"; // not ?input=test: its test device replaces the keys the bot plays
const browser = await chromium.launch({ headless: true });
const errors = [];

// Opens /play at this size and returns the page once the take is under way.
async function start(width, height, reducedMotion = "no-preference") {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${PATH}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.getByRole("button", { name: "Start", exact: true }).click({ timeout: 120_000 });
  await page.waitForFunction(() => window.__pianoArcadeHud, null, { timeout: 30_000 });
  return page;
}
const hook = (page) => page.evaluate(() => window.__pianoArcadeHud && { bar: window.__pianoArcadeHud.bar, bars: window.__pianoArcadeHud.bars, combo: window.__pianoArcadeHud.combo });

try {
  // 1, and the 1280×720 shot.
  const page = await start(1280, 720);
  const seen = [];
  let shot = false;
  const t0 = Date.now();
  while (!(await page.getByTestId("results").isVisible().catch(() => false)) && Date.now() - t0 < 150_000) {
    const h = await hook(page);
    if (h) seen.push(h);
    if (!shot && Date.now() - t0 > 20_000) {
      await page.screenshot({ path: join(out, "hud-mid-1280x720.png") });
      shot = true;
    }
    await page.waitForTimeout(250);
  }
  const bars = seen.map((s) => s.bar).filter((b) => typeof b === "number");
  const N = seen.at(-1)?.bars;
  const rising = bars.every((b, i) => i === 0 || b >= bars[i - 1]);
  check(bars.length > 0 && bars[0] === 1 && bars.at(-1) === N && N > 1 && rising, `bar: ${bars[0]} -> ${bars.at(-1)} of ${N}, ${rising ? "never down" : "went down"} (${bars.length} samples)`);
  const combos = seen.map((s) => s.combo);
  check(Math.max(...combos) > 20 && combos.at(-1) > combos[0], `combo rises: ${combos[0]} -> ${combos.at(-1)}, at most ${Math.max(...combos)}`);
  writeFileSync(join(out, "hud-samples.json"), JSON.stringify(seen));
  await page.close();

  // 2. 1920×1080 and reduced motion, about 20 s in.
  for (const [w, h, motion, name] of [
    [1920, 1080, "no-preference", "hud-mid-1920x1080.png"],
    [1920, 1080, "reduce", "hud-reduced-1920x1080.png"],
  ]) {
    const p = await start(w, h, motion);
    await p.waitForTimeout(20_000);
    await p.screenshot({ path: join(out, name) });
    await p.close();
  }
  check(shot, "screenshots: hud-mid at 1280×720 and 1920×1080, hud-reduced");
} catch (e) {
  check(false, `stopped: ${e.message}`);
}
check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
await browser.close();

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-hud: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-hud: pass (evidence: ${out})`);
process.exit(0);
