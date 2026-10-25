// Headless proof of duo-tokens (spec: Validation 3). Starts its own dev server.
// 1. / and /play?song=twinkle&input=test: the root's computed --pa-* are the Duo values, --pa-font-data is set, and
//    body's background is rgb(3, 6, 7).
// 2. /play?song=twinkle&input=test with every note pressed on time (as verify-stage does): sampled every frame, the
//    stage's element has opacity 0 whenever the fever gauge (window.__pianoArcadeFeverGauge) says no fever, and the
//    take's fever shows it.
// 3. Every element on / has a computed border-radius of 0px; /learn still has its own 4px radii.
// 4. Screenshots duo-select-<size>.png and duo-play-<size>.png at 1280×720 and 1920×1080.
// Usage: node web/src/game/duo-tokens/verify-duo.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// visual-direction.md's values, typed here, not read from the code under test.
const WANT = {
  "--pa-bg": "#030607",
  "--pa-panel": "#0a0d15",
  "--pa-ink": "#e2e6f0",
  "--pa-ink-dim": "#7d8496",
  "--pa-primary": "#2b9bff",
  "--pa-secondary": "#a07cff",
  "--pa-hand-r": "#2b9bff",
  "--pa-hand-l": "#a07cff",
  "--pa-magenta": "#ff2fd0",
  "--pa-hype": "#ff2fd0",
  "--pa-cyan": "#2b9bff",
  "--pa-miss": "#8a8f98",
  "--pa-gold": "#ffe27a",
  "--pa-wrong": "#ff4d5e",
  "--pa-good": "#7cb7ff",
};
const SIZES = [
  [1280, 720],
  [1920, 1080],
];

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-duo.mjs --out <dir>");
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
say(`verify-duo: starting next dev on ${port}`);
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
const fail = [];
const errors = [];
const results = {};
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) fail.push(line);
};
const open = async (path, [width, height] = SIZES[0]) => {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => errors.push(`${path}: ${e.message}`));
  await page.goto(`${base}${path}`);
  return page;
};
// Every note pressed at its chart time through the test hook: a perfect take (verify-stage's way; ?bot= replaces
// input=test, and only input=test has the hook).
const pressAll = (page) =>
  page.evaluate(() => {
    const { chart } = window.__pianoArcade;
    const mpb = 60000 / chart.bpm;
    for (const n of chart.notes) window.__pianoArcade.press(n.pitch, n.beat * mpb);
  });
const tokens = (page, names) =>
  page.evaluate((names) => {
    const s = getComputedStyle(document.documentElement);
    return {
      vars: Object.fromEntries(names.map((n) => [n, s.getPropertyValue(n).trim().toLowerCase()])),
      data: s.getPropertyValue("--pa-font-data").trim(),
      body: getComputedStyle(document.body).backgroundColor,
    };
  }, names);

try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(base).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  // 1. The tokens on the select and on /play.
  for (const path of ["/", "/play?song=twinkle&input=test"]) {
    const page = await open(path);
    await page.waitForLoadState("networkidle");
    const t = await tokens(page, Object.keys(WANT));
    results[path] = t;
    const wrong = Object.entries(WANT).filter(([n, v]) => t.vars[n] !== v);
    check(!wrong.length, `${path}: Duo tokens${wrong.length ? `: ${wrong.map(([n, v]) => `${n} is ${t.vars[n] || "unset"}, want ${v}`).join("; ")}` : ""}`);
    check(t.data !== "", `${path}: --pa-font-data is set (${t.data.slice(0, 40) || "unset"})`);
    check(t.body === "rgb(3, 6, 7)", `${path}: body background ${t.body}, want rgb(3, 6, 7)`);
    await page.close();
  }

  // 2. The stage only in fever. The stage's element is the one the WebGL canvas sits in.
  {
    const page = await open("/play?song=twinkle&input=test");
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    await page.evaluate(() => {
      window.__duo = [];
      const sample = () => {
        const canvas = [...document.querySelectorAll("main canvas")].find((c) => c.getContext && !c.getContext("2d"));
        const el = canvas?.parentElement;
        const g = window.__pianoArcadeFeverGauge;
        const hook = window.__pianoArcade;
        window.__duo.push({ now: hook?.now?.() ?? null, fever: !!g?.fever, stage: !!el, opacity: el ? Number(getComputedStyle(el).opacity) : null });
        if (!hook?.results) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await pressAll(page);
    await page.waitForFunction(() => window.__pianoArcade?.results, null, { timeout: 120_000 });
    const samples = await page.evaluate(() => window.__duo);
    writeFileSync(join(out, "stage-samples.json"), JSON.stringify(samples));
    const staged = samples.filter((s) => s.stage);
    const calm = staged.filter((s) => !s.fever && s.now !== null && s.now >= 0);
    const lit = staged.filter((s) => s.fever && s.opacity > 0.99);
    if (!staged.length) check(false, "stage: no WebGL stage canvas on /play, so fever-only can't be seen");
    else {
      const shown = calm.filter((s) => s.opacity > 0);
      check(calm.length > 0 && !shown.length, `stage: opacity 0 in all ${calm.length} frames played outside fever${shown.length ? `; shown in ${shown.length}, first at chart ${shown[0].now?.toFixed(0)} ms` : ""}`);
      check(lit.length > 0, `stage: shown in fever (${lit.length} frames at full opacity of ${staged.filter((s) => s.fever).length} in fever)`);
    }
    await page.close();
  }

  // 3. Zero radius on the game, /learn untouched.
  {
    const radii = (page) =>
      page.evaluate(() => {
        const seen = {};
        for (const el of document.querySelectorAll("body *")) {
          const r = getComputedStyle(el).borderTopLeftRadius;
          if (r !== "0px") seen[r] = (seen[r] ?? 0) + 1;
        }
        return seen;
      });
    const page = await open("/");
    await page.waitForLoadState("networkidle");
    const buttons = await page.locator("button").count();
    const game = await radii(page);
    results.radiiSelect = game;
    check(buttons > 0 && !Object.keys(game).length, `/: ${buttons} buttons, every element 0px${Object.keys(game).length ? `; not: ${JSON.stringify(game)}` : ""}`);
    await page.close();
    const learn = await open("/learn");
    await learn.waitForLoadState("networkidle");
    const kept = await radii(learn);
    results.radiiLearn = kept;
    check(Boolean(kept["4px"]), `/learn: keeps its own radii (${JSON.stringify(kept)}), want some 4px`);
    await learn.close();
  }

  // 4. Screenshots.
  for (const size of SIZES) {
    const tag = size.join("x");
    const select = await open("/", size);
    await select.waitForLoadState("networkidle");
    await select.waitForTimeout(800);
    await select.screenshot({ path: join(out, `duo-select-${tag}.png`) });
    await select.close();
    const play = await open("/play?song=fur-elise&input=test", size);
    await play.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    await pressAll(play);
    await play.waitForFunction(() => (window.__pianoArcade?.now?.() ?? -1) > 6000, null, { timeout: 60_000 });
    await play.screenshot({ path: join(out, `duo-play-${tag}.png`) });
    await play.close();
    say(`ok   screenshots at ${tag}`);
  }
  check(!errors.length, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
writeFileSync(join(out, "results.json"), JSON.stringify({ results, fail }, null, 2));
if (fail.length) {
  say(`verify-duo: FAIL\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
say(`verify-duo: pass (evidence: ${out})`);
process.exit(0);
