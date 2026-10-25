// Headless proof of /veritas (specs/features/veritas/spec.md, Validation), every non-localhost request aborted:
// 1. each hero run's planted equals found with 0 false alarms (Rusher: the documented gap, #545), Golden's line,
//    no page or console errors; 2. the dashboard's SHA and unit totals equal web/public/veritas/snapshot.json's;
// 3. the snapshot without `unit`, served by route interception -> unknown there, the rest as before;
// 4. reduced motion -> every run's end state at load; screenshots at 1280×720 and 1920×1080.
// Usage: node web/src/veritas/verify-veritas.mjs --out <dir>
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-veritas.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snapFile = join(webDir, "public/veritas/snapshot.json");
const snap = existsSync(snapFile) ? JSON.parse(readFileSync(snapFile, "utf8")) : null;

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
  cwd: webDir,
  detached: true,
  stdio: ["ignore", "pipe", "inherit"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
let browser;
let failed = false;
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failed = true;
};
process.on("exit", () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

const errors = [];
const outside = [];
async function open(opts, snapshotBody) {
  const ctx = await browser.newContext(opts);
  await ctx.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      outside.push(url.href);
      return route.abort("internetdisconnected");
    }
    if (snapshotBody && url.pathname === "/veritas/snapshot.json") return route.fulfill({ contentType: "application/json", body: snapshotBody });
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}/veritas`);
  await page.waitForFunction(() => document.querySelectorAll("[data-run][data-planted]").length === 5, null, { timeout: 60_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Loading the last CI run"), null, { timeout: 30_000 });
  return page;
}
const keys = (page) => page.$$eval("[data-k]", (els) => Object.fromEntries(els.map((e) => [e.dataset.k, e.dataset.n])));
const show = (v) => (v === null || v === undefined ? "unknown" : String(v));

try {
  for (let end = Date.now() + 180_000; ; await sleep(500)) {
    if (await fetch(`${base}/veritas`).then((r) => r.ok, () => false)) break;
    if (server.exitCode !== null) throw new Error("next dev exited (is another dev server running in web/?)");
    if (Date.now() > end) throw new Error("dev server not up after 180 s");
  }
  browser = await chromium.launch({ headless: true });

  // 1. The hero.
  const page = await open({ viewport: { width: 1920, height: 1080 } });
  const runs = await page.$$eval("[data-run]", (els) => els.map((e) => ({ id: e.dataset.run, planted: e.dataset.planted, found: e.dataset.found, fa: e.dataset.falseAlarms })));
  for (const r of runs) {
    if (r.id === "rusher") check(r.planted === "1" && r.found === "none" && r.fa === "0", `rusher: 1 planted, no rushing flag (#545), 0 false alarms (${r.planted}/${r.found}/${r.fa})`);
    else check(Number(r.planted) > 0 && r.found === r.planted && r.fa === "0", `${r.id}: ${r.planted} planted, ${r.found} found, ${r.fa} false alarms`);
  }
  const goldenLine = (await page.locator('[data-run="golden"] [data-tally]').innerText()).replace(/\s+/g, " ").trim();
  check(goldenLine === "2 planted, 2 found, 0 false alarms", `golden says "${goldenLine}"`);
  check((await page.title()) === "Veritas · Piano Arcade", `title "${await page.title()}"`);

  // 2. The dashboard against the snapshot file.
  if (snap) {
    const k = await keys(page);
    const want = {
      sha: show(snap.run.sha?.slice(0, 7)),
      conclusion: show(snap.run.conclusion),
      ...(snap.unit && {
        unitTests: show(snap.unit.totals.tests),
        unitPassed: show(snap.unit.totals.passed),
        unitFailed: show(snap.unit.totals.failed),
        unitSkipped: show(snap.unit.totals.skipped),
        unitFiles: show(snap.unit.totals.files),
      }),
    };
    const wrong = Object.entries(want).filter(([key, v]) => k[key] !== v);
    check(wrong.length === 0, `dashboard SHA and unit totals equal snapshot.json's (${Object.keys(want).length} values)${wrong.length ? `: ${JSON.stringify(wrong)}` : ""}`);
    check(
      (await page.locator("text=CI didn't keep browser check results").count()) === (snap.browser ? 0 : 1),
      `browser checks: ${snap.browser ? `${snap.browser.length} rows` : "unknown, said so"}`,
    );

    // 3. Without `unit`: unknown there, the rest as before.
    const noUnit = await open({ viewport: { width: 1280, height: 720 } }, JSON.stringify({ ...snap, unit: null }));
    const k3 = await keys(noUnit);
    check(
      (await noUnit.locator("text=CI didn't keep unit results").count()) === 1 && !("unitTests" in k3) && k3.sha === want.sha,
      "a snapshot without unit: unit results unknown, said so; the SHA as before",
    );
  } else {
    check((await page.locator("text=No snapshot frozen yet").count()) === 1, "no snapshot: the page says to run freeze.mjs");
  }
  await page.screenshot({ path: join(out, "veritas-1920.png"), fullPage: true });

  // 4. Reduced motion: every tally and mark shows at load, no playhead.
  const still = await open({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const hidden = await still.$$eval("[data-tally], [data-mark]", (els) => els.filter((e) => getComputedStyle(e).opacity !== "1").length);
  const marks = await still.locator("[data-mark]").count();
  check(hidden === 0 && marks > 0, `reduced motion: all ${marks} marks and 5 tallies show at load`);
  await still.screenshot({ path: join(out, "veritas-1280.png"), fullPage: true });
  // Not reduced: the later runs wait for their sweep.
  const moving = await open({ viewport: { width: 1280, height: 720 } });
  const waiting = await moving.$$eval("[data-tally]", (els) => els.filter((e) => getComputedStyle(e).opacity === "0").length);
  check(waiting >= 3, `with motion, later runs' tallies wait for their sweep (${waiting} of 5 hidden at load)`);

  check(outside.length === 0, `no request off localhost${outside.length ? `: ${outside.slice(0, 5).join(", ")}` : ""}`);
  check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (e) {
  check(false, String(e?.stack ?? e));
} finally {
  await browser?.close();
}
writeFileSync(join(out, "server.log"), log);
say(failed ? "verify-veritas: FAIL" : `verify-veritas: pass (screenshots in ${out})`);
process.exit(failed ? 1 : 0);
