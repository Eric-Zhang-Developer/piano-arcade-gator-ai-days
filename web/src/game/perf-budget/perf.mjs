// Perf budget's run (spec: perf-budget): frame work time during fever on the densest chart at 1920×1080, stage on.
// Builds and serves the app (or uses --base), plays the scene --runs times on a fresh page each, and writes perf.json.
// Exit 0 pass, 1 over budget or an invalid run, 2 when it can't run (build, browser, server).
// --dpr 2 measures at a Retina MacBook's devicePixelRatio. Each run also reports the page's <canvas> count and their
// total backing size in megapixels: what the compositor blends every frame, which no callback time shows (#665's lag).
// Usage: node web/src/game/perf-budget/perf.mjs [--song maple-leaf-rag] [--runs 3] [--dpr 1] [--params k=v&…] [--base <url>] [--out <dir>]
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const probeText = readFileSync(new URL("./probe.js", import.meta.url), "utf8");
const say = (s) => process.stdout.write(`${s}\n`);
const fail = (s) => {
  say(`perf-budget: ${s}`);
  process.exit(2);
};
const arg = (name, d) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : d);

const song = arg("--song", "maple-leaf-rag");
const runs = Number(arg("--runs", 3));
const dpr = Number(arg("--dpr", 1));
const extra = new URLSearchParams(arg("--params", ""));
const git = (...a) => execFileSync("git", a, { cwd: webDir, encoding: "utf8" }).trim();
const sha = git("rev-parse", "--short", "HEAD");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const out = resolve(arg("--out", join(resolve(webDir, git("rev-parse", "--git-common-dir")), "agent-evidence", "perf-budget", stamp)));

// The probe's stats and verdict, from the same text the page runs.
const sandbox = { window: { performance, requestAnimationFrame: () => 0 } };
vm.runInNewContext(probeText, sandbox);
const { verdict, budgetMs } = sandbox.window.__perfProbe;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  fail("Playwright isn't installed: run `pnpm -C web install`");
}

let base = arg("--base", null);
let server = null;
if (base) {
  try {
    await fetch(base, { signal: AbortSignal.timeout(5000) });
  } catch {
    fail(`can't reach ${base}: start the app there, or leave out --base`);
  }
} else {
  say("perf-budget: next build");
  const b = spawnSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) fail("the build failed: run `pnpm -C web build` to see why");
  const port = await new Promise((res, rej) => {
    const s = createServer().once("error", rej);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
  base = `http://localhost:${port}`;
  say(`perf-budget: next start on ${port}`);
  server = spawn(join(webDir, "node_modules/.bin/next"), ["start", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
  process.on("exit", () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(2));
  const until = Date.now() + 60_000;
  for (;;) {
    try {
      await fetch(base, { signal: AbortSignal.timeout(2000) });
      break;
    } catch {
      if (Date.now() > until) fail(`next start didn't answer on ${base} within 60 s`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

const params = new URLSearchParams({ song, bot: "fever", labels: "notes", capture: "1" });
for (const [k, v] of extra) params.set(k, v);
const url = `${base}/play?${params}`;
const stageOff = params.get("stage") === "off";

let browser;
try {
  // On a Mac, draw WebGL on the GPU through Metal: in SwiftShader the stage's own frame guard froze it every run
  // (specs/decisions/perf-budget-gpu.md). Elsewhere, Chromium's default; the renderer string says which.
  const gpu = process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [];
  browser = await chromium.launch({ headless: true, args: gpu });
} catch {
  fail("no Chromium for Playwright: run `pnpm -C web exec playwright install chromium`");
}

async function run(i) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  await page.addInitScript(probeText);
  let frozen = false;
  let started = 0;
  let frozenAtMs = null; // after Start, so a person can tell a cold start from a dense passage
  page.on("console", (m) => {
    if (!/fever-stage: .*frozen/.test(m.text())) return;
    frozen = true;
    frozenAtMs = Date.now() - started;
  });
  await page.goto(url);
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 60_000 });
  started = Date.now();
  await start.click();
  await page.waitForTimeout(2000);
  const stage = (await page.locator("main > div canvas").count()) > 0;
  const canvases = await page.evaluate(() => {
    const cs = [...document.querySelectorAll("canvas")];
    return { count: cs.length, mp: cs.reduce((a, c) => a + c.width * c.height, 0) / 1e6 };
  });
  await page.getByTestId("results").waitFor({ timeout: 300_000 });
  const r = await page.evaluate(() => ({ ...window.__perfProbe.report(), feverSeen: window.__perfProbe.feverSeen(), gaps: window.__perfProbe.intervals() }));
  await context.close();
  const invalid = !r.feverSeen
    ? "never reached fever"
    : frozen
      ? "fever-stage froze the stage"
      : !stage && !stageOff
        ? "no stage canvas"
        : r.frames === 0
          ? "no frames counted"
          : undefined;
  const round = (x) => (x === null ? null : Math.round(x * 100) / 100);
  const res = {
    frames: r.frames,
    p50: round(r.p50),
    p95: round(r.p95),
    max: round(r.max),
    interval: { p50: round(r.gaps.p50), p95: round(r.gaps.p95) },
    canvases: canvases.count,
    canvasMP: round(canvases.mp),
    ...(invalid ? { invalid } : {}),
    ...(frozen ? { frozenAtMs } : {}),
  };
  say(
    `perf-budget: run ${i + 1}: ${res.frames} frames, p50 ${res.p50}, p95 ${res.p95}, max ${res.max} ms; interval p50 ${res.interval.p50}, p95 ${res.interval.p95} ms; ${res.canvases} canvases, ${res.canvasMP} MP${invalid ? ` (invalid: ${invalid}${frozen ? ` ${frozenAtMs} ms after Start` : ""})` : ""}`,
  );
  return res;
}

// The WebGL renderer string (SwiftShader when headless draws in software): the GPU caveat goes with the numbers.
const probePage = await browser.newPage();
const renderer = await probePage.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return gl ? gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : null;
});
await probePage.close();

const results = [];
for (let i = 0; i < runs; i++) results.push(await run(i));
await browser.close();

const v = verdict(results);
const p95s = results.map((r) => r.p95).filter((x) => x !== null);
const lo = p95s.length ? Math.min(...p95s) : null;
const hi = p95s.length ? Math.max(...p95s) : null;
const range = (xs) => (xs.length ? `${Math.min(...xs)}–${Math.max(...xs)}` : "none");
mkdirSync(out, { recursive: true });
writeFileSync(
  join(out, "perf.json"),
  JSON.stringify(
    {
      commit: sha,
      url,
      viewport: { width: 1920, height: 1080 },
      devicePixelRatio: dpr,
      chromium: browser.version(),
      webglRenderer: renderer,
      budgetMs,
      runs: results,
      p95Spread: { lo, hi },
      pass: v.pass,
      invalid: v.invalid,
      note: "p50/p95/max are main-thread work only: GPU work isn't in a callback's time. interval is frame to frame, compositing included, but noisy headless (an empty page reads p95 17.6 ms): compare runs, don't budget it. canvases and canvasMP are what's composited each frame. A SwiftShader renderer means WebGL was drawn in software.",
    },
    null,
    2,
  ),
);
say(`perf-budget: perf.json in ${out}`);
for (const why of v.invalid) say(`perf-budget: invalid ${why}`);
say(
  `perf-budget: p95 ${range(p95s)} ms over ${results.length} runs (p50 ${range(results.map((r) => r.p50).filter((x) => x !== null))}, max ${range(results.map((r) => r.max).filter((x) => x !== null))}) at ${sha}, devicePixelRatio ${dpr}, ${results[0]?.canvases ?? "?"} canvases: ${v.pass ? "pass" : v.invalid.length ? "invalid" : "over budget"}`,
);
process.exit(v.pass ? 0 : 1);
