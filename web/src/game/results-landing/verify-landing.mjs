// Headless proof of the results landing (spec: results-landing, Validation 2). Starts its own dev server, plays
// /play?song=twinkle&bot=perfect&x=results-landing and &bot=rank-c, and prints `verify-landing: pass` or each failed check:
// 1. the stamp settles on its planned frame (seek hook stepped at 60 fps): scale 1 from the settle frame ± 1, no shake;
// 2. T0 to the end state is ≤ 2.8 s in a real run (no seeking);
// 3. no long task over 300 ms from T0 to the end; a click at five points after the mount reaches the end state within
//    300 ms and doesn't press Retry;
// 4. reduced motion: the first frame after the mount is the end state;
// 5. without the flag nothing changes: no landing, today's tail and today's CSS stamp;
// 6. no console error.
// Usage: node web/src/game/results-landing/verify-landing.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-landing.mjs --out <dir>");
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
say(`verify-landing: starting next dev on ${port}`);
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
const FRAME = 1000 / 60;

const browser = await chromium.launch({ headless: true });
const errors = [];

// Watches the page from before its scripts run: T0 (the hook appears), the mount, the end state, long tasks, and the
// landing's state at the results' first mutation.
const watch = () => {
  const w = (window.__landingWatch = { t0: null, mount: null, end: null, long: [], first: null });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) w.long.push({ at: e.startTime, ms: e.duration });
  }).observe({ type: "longtask", buffered: true });
  const tick = () => {
    const now = performance.now();
    if (w.t0 === null && window.__pianoArcadeLanding) w.t0 = now;
    const r = document.querySelector('[data-testid="results"]');
    if (r && w.mount === null) w.mount = now;
    if (r?.dataset.landing === "end" && w.end === null) w.end = now;
    setTimeout(tick, 2);
  };
  tick();
  new MutationObserver(() => {
    const r = document.querySelector('[data-testid="results"]');
    if (!r || w.first) return;
    const rank = document.querySelector('[data-testid="rank"]');
    w.first = { landing: r.dataset.landing ?? null, rankTransform: rank?.style.transform ?? null, rankOpacity: rank?.style.opacity ?? null, flies: document.querySelectorAll("[data-landing-fly]").length };
  }).observe(document, { childList: true, subtree: true });
};

async function open(path, { reduced = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: reduced ? "reduce" : "no-preference" });
  page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${path}: ${m.text()}`));
  await page.addInitScript(watch);
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves
  return page;
}
const results = (page) => page.getByTestId("results").waitFor({ timeout: 180_000 });
const watched = (page) => page.evaluate(() => window.__landingWatch);

for (const bot of ["perfect", "rank-c"]) {
  const path = `/play?song=twinkle&bot=${bot}&stage=off&idle=3600&x=results-landing`;
  // 2 and 3: a real run, no seeking.
  const page = await open(path);
  await results(page);
  await page.waitForFunction(() => window.__landingWatch.end !== null, null, { timeout: 10_000 }).catch(() => {});
  const w = await watched(page);
  const total = w.end !== null && w.t0 !== null ? w.end - w.t0 : null;
  check(total !== null && total <= 2800, `${bot}: T0 to the end state is ≤ 2.8 s in a real run (${total?.toFixed(0)} ms)`);
  const long = w.long.filter((l) => w.t0 !== null && l.at >= w.t0 - 50 && l.ms > 300);
  check(long.length === 0, `${bot}: no long task over 300 ms from T0 to the end state (${JSON.stringify(long)})`);
  await page.screenshot({ path: join(out, `landing-${bot}-end-1280x720.png`) });

  // 1: the stamp settles on its planned frame, stepped at 60 fps from the seek hook.
  const steps = await page.evaluate((FRAME) => {
    const L = window.__pianoArcadeLanding;
    L.pause();
    const rank = document.querySelector('[data-testid="rank"]');
    const rows = [];
    for (let f = Math.floor(L.plan.stampAtMs / FRAME) - 2; f * FRAME <= L.plan.stampAtMs + 180 + 6 * FRAME; f++) {
      L.seek(f * FRAME);
      const m = new DOMMatrixReadOnly(getComputedStyle(rank).transform === "none" ? undefined : getComputedStyle(rank).transform);
      rows.push({ f, scale: Math.hypot(m.a, m.b), x: m.e });
    }
    return { rows, settle: Math.ceil((L.plan.stampAtMs + 180) / FRAME) };
  }, FRAME);
  const settled = steps.rows.filter((r) => r.f >= steps.settle + 1);
  const early = steps.rows.find((r) => r.f < steps.settle - 1 && r.f * FRAME >= steps.rows[0].f * FRAME + 2 * FRAME && Math.abs(r.scale - 1) > 1e-3);
  check(
    settled.length > 0 && settled.every((r) => Math.abs(r.scale - 1) < 1e-4 && Math.abs(r.x) < 1e-4) && early !== undefined,
    `${bot}: the stamp moves, then settles at scale 1 with no shake from frame ${steps.settle} ± 1 (${JSON.stringify(settled.slice(0, 2))})`,
  );

  // 3: a click at five points after the mount jumps to the end state within 300 ms and doesn't retry.
  const clicks = [];
  for (const k of [0.05, 0.25, 0.45, 0.65, 0.85]) {
    const res = await page.evaluate((k) => {
      const L = window.__pianoArcadeLanding;
      L.play();
      L.seek(400 + k * (L.plan.endMs - 400));
      return { at: L.t, results: window.__pianoArcade.results };
    }, k);
    const retry = page.getByRole("button", { name: "Retry" });
    const t = Date.now();
    await retry.click({ timeout: 2000, force: true });
    const reached = await page.waitForFunction(() => window.__pianoArcadeLanding.t >= window.__pianoArcadeLanding.plan.endMs, null, { timeout: 300 }).then(
      () => true,
      () => false,
    );
    const ms = Date.now() - t;
    const still = (await page.getByTestId("results").count()) === 1;
    clicks.push({ at: Math.round(res.at), reached, ms, still });
  }
  check(clicks.every((c) => c.reached && c.still), `${bot}: a click at five points reaches the end state within 300 ms and doesn't press Retry (${JSON.stringify(clicks)})`);
  await page.close();

  // 4: reduced motion, the first frame after the mount is the end state.
  const rm = await open(path, { reduced: true });
  await results(rm);
  const first = (await watched(rm)).first;
  check(first?.landing === "end" && !first.rankTransform && first.rankOpacity === "1" && first.flies === 0, `${bot}: reduced motion's first frame after the mount is the end state (${JSON.stringify(first)})`);
  await rm.screenshot({ path: join(out, `landing-${bot}-reduced-motion-1280x720.png`) });
  await rm.close();
}

// 5: without the flag, nothing changes.
const plain = await open("/play?song=twinkle&bot=perfect&stage=off&idle=3600");
await results(plain);
const p = await plain.evaluate(() => {
  const w = window.__landingWatch;
  const rank = document.querySelector('[data-testid="rank"]');
  return { hook: !!window.__pianoArcadeLanding, attr: document.querySelector('[data-testid="results"]').dataset.landing ?? null, anim: rank && getComputedStyle(rank).animationName, flies: document.querySelectorAll("[data-landing-fly]").length, t0: w.t0 };
});
check(!p.hook && p.attr === null && p.t0 === null && p.flies === 0 && p.anim === "juice-rank", `without the flag: no landing, and the rank keeps today's CSS stamp (${JSON.stringify(p)})`);
await plain.close();

check(errors.length === 0, `no console error${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
await browser.close();
say(failures.length ? `verify-landing: FAIL (${failures.length})` : "verify-landing: pass");
process.exit(failures.length ? 1 : 0);
