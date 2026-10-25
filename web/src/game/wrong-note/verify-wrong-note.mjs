// Headless proof of the wrong-note spike (spec: wrong-note-spike, Validation 2). Starts its own dev server; prints
// `verify-wrong-note: pass` and exits 0, or names each failure and exits 1.
// 1. /wrong-note?song=twinkle&seed=1&midi=sim, Start: round 1 asks. The round comes from the page's test hook.
// 2. The right pad -> "Right"; Next; a wrong pad -> "It was note n".
// 3. Play to the end -> "n / 10", the set listed; Again -> round 1 of the next seed. A screenshot of the set's end.
// No page error or console error throughout.
// Usage: node web/src/game/wrong-note/verify-wrong-note.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-wrong-note.mjs --out <dir>");
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
say(`verify-wrong-note: starting next dev on ${port}`);
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (let i = 0; ; i++) {
  try {
    await page.goto(`${base}/wrong-note?song=twinkle&seed=1&midi=sim`);
    break;
  } catch (e) {
    if (i > 60) throw e;
    await page.waitForTimeout(1000); // the dev server is still starting
  }
}

const hook = () => page.evaluate(() => window.__wrongNote);
const call = () => page.getByTestId("call").textContent();
try {
  await page.getByTestId("start").waitFor({ timeout: 60_000 });
  await page.getByTestId("start").click();
  await page.waitForFunction(() => window.__wrongNote?.phase === "ask", null, { timeout: 10_000 });
  let h = await hook();
  check(h.index === 0 && h.seed === 1 && h.changed >= 2 && h.changed <= 8, `Start: round 1 asks (note ${h.changed} moved, seed ${h.seed})`);

  await page.getByTestId(`pad-${h.changed}`).click();
  check((await call()) === "Right", `the right pad (${h.changed}) -> "${await call()}"`);
  await page.getByTestId("next").click();
  h = await hook();
  const wrong = h.changed === 2 ? 3 : 2;
  await page.getByTestId(`pad-${wrong}`).click();
  check((await call()) === `It was note ${h.changed}`, `a wrong pad (${wrong}) -> "${await call()}"`);

  for (let k = 2; k < 10; k++) {
    await page.getByTestId("next").click();
    h = await hook();
    await page.keyboard.press(String(h.changed)); // the number keys answer too
  }
  await page.getByTestId("next").click();
  const score = await page.getByTestId("score").textContent();
  check(/^9\s*\/ 10$/.test(score.trim()), `to the end: "${score.trim()}" (one wrong of ten)`);
  const sets = await page.getByTestId("sets").textContent();
  check(sets.includes("seed 1") && sets.includes("9/10"), `the set is listed: ${sets.trim()}`);
  await page.screenshot({ path: join(out, "wrong-note-done.png") });

  await page.getByTestId("start").click();
  await page.waitForFunction(() => window.__wrongNote?.phase === "ask", null, { timeout: 10_000 });
  h = await hook();
  check(h.index === 0 && h.seed === 2, `Again -> round 1 of seed ${h.seed}`);
} catch (e) {
  check(false, `error: ${e.message}`);
}
check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
await browser.close();
say(failures.length ? `verify-wrong-note: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-wrong-note: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
