// Headless proof of the Simon Says spike (spec: simon-says-spike, Validation 2). Starts its own dev server; prints
// `verify-simon: pass` and exits 0, or names each failure and exits 1. Headless has no MIDI, so it plays laptop keys:
// 1. /simon?song=twinkle, Start; round 1's keys, found by each drawn key's data-code -> "Round 2".
// 2. One wrong key in round 2 -> "Run over" at round 2, the expected key lit; the run is listed. A screenshot.
// 3. Again -> round 1. No page error or console error throughout.
// Usage: node web/src/game/simon/verify-simon.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-simon.mjs --out <dir>");
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
say(`verify-simon: starting next dev on ${port}`);
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

// The check's own reading of the spec's rule: the right hand's highest pitch at each beat, in beat order.
const chart = JSON.parse(readFileSync(join(webDir, "public/songs/twinkle/chart.json"), "utf8"));
const top = new Map();
for (const n of chart.notes) if (n.hand === "R" && !(top.get(n.beat) >= n.pitch)) top.set(n.beat, n.pitch);
const tune = [...top.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (let i = 0; ; i++) {
  try {
    await page.goto(`${base}/simon?song=twinkle`);
    break;
  } catch (e) {
    if (i > 60) throw e;
    await page.waitForTimeout(1000); // the dev server is still starting
  }
}

const stage = page.locator("section");
const seen = async (text) => {
  try {
    await stage.getByText(text).first().waitFor({ timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
};
const press = async (pitch) => {
  const code = await page.locator(`[data-pitch="${pitch}"]`).getAttribute("data-code");
  if (!code) throw new Error(`no laptop key for pitch ${pitch}`);
  await page.keyboard.press(code);
};

try {
  await page.getByRole("button", { name: /Start/ }).waitFor({ timeout: 120_000 });
  await page.keyboard.press("Space");
  check(await seen("Round 1 · Listen"), `Space starts round 1`);
  check(await seen("Your turn"), `"Your turn" after round 1's phrase`);
  for (const p of tune.slice(0, 2)) await press(p);
  check(await seen("Round 2"), `round 1's keys (${tune.slice(0, 2).join(", ")}) -> "Round 2"`);

  check(await seen("Your turn"), `"Your turn" after round 2's phrase`);
  const wrong = Number(await page.locator(`[data-code]:not([data-pitch="${tune[0]}"])`).first().getAttribute("data-pitch"));
  await press(wrong);
  check(await seen("Run over · round 2"), `a wrong key (${wrong}) -> "Run over · round 2"`);
  check((await page.locator(`[data-lit][data-pitch="${tune[0]}"]`).count()) === 1, `the expected key (${tune[0]}) is lit`);
  const listed = await page.getByText("twinkle · round 2").boundingBox();
  check(listed !== null && listed.y + listed.height <= 720, `the run is listed as "twinkle · round 2", on screen`);
  await page.screenshot({ path: join(out, "run-over-1280x720.png") });
  check(!(await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight)), "no page scroll");

  await page.getByRole("button", { name: /Again/ }).click();
  check(await seen("Round 1 · Listen"), `Again -> round 1`);
} catch (e) {
  check(false, `stopped: ${e.message}`);
}
check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
await browser.close();

say(failures.length ? `verify-simon: ${failures.length} failed` : `verify-simon: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
