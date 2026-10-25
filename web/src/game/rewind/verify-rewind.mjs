// Headless proof of rewind (spec: rewind, Validation). In wait mode on Twinkle, ← goes back a bar and makes its notes
// judgeable again, → skips ahead a bar; plain mode ignores the keys; a chunk learn step rewinds within its chunk; the
// start screen shows the hint. Starts its own dev server.
// Usage: node web/src/game/rewind/verify-rewind.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-rewind.mjs --out <dir>");
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
say(`verify-rewind: starting next dev on ${port}`);
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
const waitHud = (page) => page.evaluate(() => window.__pianoArcadeWaitHud?.n ?? null);
const now = (page) => page.evaluate(() => Math.round(window.__pianoArcade.now()));

async function goto(page, path) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      return;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}

async function open(page, query) {
  await goto(page, `/play?song=twinkle&input=test${query}`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  return page.evaluate(() => {
    const c = window.__pianoArcade.chart;
    const beat = 60000 / c.bpm;
    return { notes: c.notes.map((n) => [n.pitch, n.beat * beat]), barMs: c.beatsPerBar * beat };
  });
}

// Each note pressed once the clock has stopped on it, as a learner would.
const press = (page, notes) =>
  page.evaluate(async (notes) => {
    const hook = window.__pianoArcade;
    for (const [p, t] of notes) {
      while (hook.now() < t) await new Promise(requestAnimationFrame);
      hook.press(p, t);
    }
  }, notes);

// The clock reads `want` now and still does 600 ms later: it holds there.
async function holdsAt(page, want, line) {
  await page.waitForFunction((w) => Math.abs(window.__pianoArcade.now() - w) < 2, want, { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(100); // the hold sets on the next frame; between frames a running clock may still pass `want`
  const a = await now(page);
  await page.waitForTimeout(600);
  const b = await now(page);
  check(Math.abs(a - want) < 2 && Math.abs(b - want) < 2, `${line}: now() ${a} then ${b}, want it held at ${want}`);
}

async function hud(page, want, line) {
  await page.waitForFunction((w) => window.__pianoArcadeWaitHud?.n === w, want, { timeout: 5_000 }).catch(() => {});
  const n = await waitHud(page);
  check(n === want, `${line}: wait-hud n ${n}, want ${want}`);
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const newPage = async (w = 1280, h = 720) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
};
try {
  // 1–3. Twinkle in wait mode: bars are 2400 ms; bar 1 is notes 1–4, bar 2 notes 5–7 (2400, 3000, 3600).
  let page = await newPage();
  const { notes } = await open(page, "&mode=wait");
  await press(page, notes.slice(0, 5));
  await holdsAt(page, 3000, "bar 1 and bar 2's first note pressed");
  await hud(page, 6, "bar 1 and bar 2's first note pressed");
  await page.keyboard.press("ArrowLeft");
  await holdsAt(page, 0, "←");
  await hud(page, 1, "←");
  await press(page, notes.slice(0, 4));
  await hud(page, 5, "bar 1 pressed again (judgeable after ←)");
  await holdsAt(page, 2400, "bar 1 pressed again: bar 2's first note waits again");
  await page.keyboard.press("ArrowRight");
  await holdsAt(page, 4800, "→");
  await hud(page, 8, "→ (bar 2's three notes skipped)");
  await page.close();

  // 4. Plain mode: the same key does nothing, the clock keeps running.
  page = await newPage();
  await open(page, "");
  await page.waitForFunction(() => window.__pianoArcade.now() > 3000, null, { timeout: 30_000 });
  await page.keyboard.press("ArrowLeft");
  const a = await now(page);
  await page.waitForTimeout(500);
  const b = await now(page);
  check(a > 3000 && b > a + 300, `plain mode, ← at 3000+: now() ${a} then ${b}, want it rising`);
  await page.close();

  // 5. A chunk learn step (bars 5–8 at 70 %): ← in its second bar goes to its first bar's start.
  page = await newPage();
  const chunk = await open(page, "&from=5&to=8&tempo=70&passes=1&mode=wait&practice=1");
  const upTo = chunk.notes.findIndex(([, t]) => t > chunk.barMs + 1);
  await press(page, chunk.notes.slice(0, upTo));
  await page.waitForFunction((t) => window.__pianoArcade.now() > t, chunk.barMs + 1, { timeout: 5_000 }).catch(() => {});
  const held = await now(page);
  check(held > chunk.barMs + 1, `chunk step: held at ${held} in its second bar (starts ${Math.round(chunk.barMs)})`);
  await page.keyboard.press("ArrowLeft");
  await holdsAt(page, 0, "chunk step, ← in its second bar");
  await page.close();

  // The start-screen hint, at both sizes; plain mode has none.
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    page = await newPage(w, h);
    await goto(page, "/play?song=twinkle&mode=wait");
    const hint = page.getByTestId("rewind-hint");
    const shown = await hint.waitFor({ timeout: 60_000 }).then(() => true, () => false);
    check(shown && (await hint.innerText()).includes("back or ahead a bar"), `${w}×${h} wait-mode start screen: the ← → hint`);
    await page.screenshot({ path: join(out, `start-${w}.png`) });
    await page.close();
  }
  page = await newPage();
  await goto(page, "/play?song=twinkle");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000); // the start panel's slots have rendered
  check((await page.getByTestId("rewind-hint").count()) === 0, "plain start screen: no hint");
  await page.close();
} catch (e) {
  check(false, `error: ${e.message}`);
} finally {
  await browser.close();
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "result.json"), JSON.stringify({ failures, errors }, null, 2));
say(failures.length ? `verify-rewind: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-rewind: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
