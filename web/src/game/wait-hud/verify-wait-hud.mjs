// Headless proof of wait-hud (spec: wait-hud, Validation). On /play?song=twinkle&mode=wait&input=test: the HUD says
// note 1 / 42 at the first hold and 42 / 42 at the end, with no combo milestone and no FULL COMBO; a bar loop in wait
// mode ends with no Passes list. Starts its own dev server.
// Usage: node web/src/game/wait-hud/verify-wait-hud.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-wait-hud.mjs --out <dir>");
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
say(`verify-wait-hud: starting next dev on ${port}`);
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
const waitHud = (page) => page.evaluate(() => window.__pianoArcadeWaitHud ?? null);

async function open(page, query) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/play?song=twinkle&mode=wait&input=test${query}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  // From load: did FULL COMBO ever attach?
  await page.evaluate(() => {
    window.__sawFullCombo = !!document.querySelector('[data-testid="full-combo"]');
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="full-combo"]')) window.__sawFullCombo = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  return page.evaluate(() => window.__pianoArcade.chart);
}

// Each note pressed once the clock has stopped on it, as a learner would.
const playAll = (page, chart) =>
  page.evaluate(async (notes) => {
    const hook = window.__pianoArcade;
    for (const [p, t] of notes) {
      while (hook.now() < t) await new Promise(requestAnimationFrame);
      hook.press(p, t);
    }
  }, chart.notes.map((n) => [n.pitch, n.beat * (60000 / chart.bpm)]));

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  // 1. The first hold, at both sizes.
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "");
    await page.waitForFunction(() => window.__pianoArcade.now() >= 0, null, { timeout: 30_000 });
    await page.waitForTimeout(500);
    const s = await waitHud(page);
    check(s?.n === 1 && s?.N === 42, `${w}×${h} at the first hold: ${JSON.stringify(s)}, want {"n":1,"N":42}`);
    await page.screenshot({ path: join(out, `hold-${w}.png`) });
    if (w === 1920) await page.close();
    else {
      // 2. Every note: 42 / 42, no milestone, no FULL COMBO.
      const chart = await page.evaluate(() => window.__pianoArcade.chart);
      await playAll(page, chart);
      await page.getByTestId("results").waitFor({ timeout: 120_000 });
      const end = await waitHud(page);
      check(end?.n === 42 && end?.N === 42, `after every note: ${JSON.stringify(end)}, want {"n":42,"N":42}`);
      const milestone = await page.evaluate(() => window.__pianoArcadeHud?.milestone ?? null);
      check(milestone === null, `HUD milestone ${JSON.stringify(milestone)}, want null (25 if the judge had sent it)`);
      check(!(await page.evaluate(() => window.__sawFullCombo)), "FULL COMBO never attached");
      await page.screenshot({ path: join(out, "results-1280.png"), fullPage: true });
      await page.close();
    }
  }

  // 3. A bar loop in wait mode: results with no Passes list.
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(e.message));
  const loop = await open(page, "&from=1&to=4&tempo=70&passes=1");
  await playAll(page, loop);
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(300);
  check((await page.locator('[data-testid="bar-loop-passes"]').count()) === 0, "a wait-mode bar loop shows no Passes list");
  await page.close();
} catch (e) {
  check(false, `error: ${e.message}`);
} finally {
  await browser.close();
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "result.json"), JSON.stringify({ failures, errors }, null, 2));
say(failures.length ? `verify-wait-hud: FAIL (${failures.length})` : `verify-wait-hud: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
