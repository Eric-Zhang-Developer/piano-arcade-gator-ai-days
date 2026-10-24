// Headless proof of fever-moment (spec: fever-moment, Validation; verify-fever.mjs is the model). Bot takes with
// fever: screenshots at +0, +200 ms and +2 s after fever starts, and each run fails unless the moment stopped drawing
// within 2 s of its start (1 s under reduced motion). Starts its own dev server.
// Usage: node web/src/game/fever-moment/verify-moment.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-moment.mjs --out <dir>");
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
say(`verify-moment: starting next dev on ${port}`);
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

const RUNS = [
  { name: "minuet-1920", song: "minuet-g", bot: "fever", w: 1920, h: 1080, shots: [0, 200, 2000] },
  { name: "minuet-1280", song: "minuet-g", bot: "fever", w: 1280, h: 720, shots: [0, 200, 2000] },
  { name: "minuet-1920-reduced", song: "minuet-g", bot: "fever", w: 1920, h: 1080, shots: [0, 200, 2000], reduce: true },
  { name: "maple-1920", song: "maple-leaf-rag", bot: "perfect", w: 1920, h: 1080, shots: [200] },
];

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const r of RUNS) {
    const page = await browser.newPage({ viewport: { width: r.w, height: r.h }, reducedMotion: r.reduce ? "reduce" : "no-preference" });
    page.on("pageerror", (e) => errors.push(`${r.name}: ${e.message}`));
    for (let i = 0; ; i++) {
      try {
        await page.goto(`${base}/play?song=${r.song}&bot=${r.bot}&beat=off`);
        break;
      } catch (e) {
        if (i > 60) throw e;
        await page.waitForTimeout(1000); // the dev server is still starting
      }
    }
    await page.getByRole("button", { name: "Start" }).click({ timeout: 120_000 }).catch(() => {}); // bots may start themselves
    await page.waitForFunction(() => window.__pianoArcadeFeverGauge?.fever === true, null, { timeout: 120_000 });
    const t0 = Date.now();
    for (const at of r.shots) {
      await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
      await page.screenshot({ path: join(out, `${r.name}-${at}.png`) });
    }
    await page.waitForTimeout(Math.max(0, 2500 - (Date.now() - t0)));
    const m = await page.evaluate(() => window.__pianoArcadeFeverMoment ?? null);
    const limit = r.reduce ? 1000 : 2000;
    check(m?.startAtMs != null && m?.lastDrawnAtMs != null, `${r.name}: the moment drew (${JSON.stringify(m)})`);
    if (m?.lastDrawnAtMs != null) check(m.lastDrawnAtMs <= m.startAtMs + limit, `${r.name}: last drawn ${Math.round(m.lastDrawnAtMs - m.startAtMs)} ms after the start, within ${limit}`);
    await page.close();
  }
} catch (e) {
  check(false, `error: ${e.message}`);
} finally {
  await browser.close();
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "result.json"), JSON.stringify({ failures, errors }, null, 2));
say(failures.length ? `verify-moment: FAIL (${failures.length})` : `verify-moment: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
