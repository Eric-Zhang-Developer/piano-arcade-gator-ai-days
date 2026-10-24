// Headless proof of versus (spec: versus, the Chrome step): /play?versus=1&input=test on Twinkle, with the test hook
// playing every note of both copies on time -> both halves show notes, and the results show DRAW at 100% each.
// Moonlight (3rd mvt) doesn't fit the split: its start screen says so and the song plays normally.
// Usage: node web/src/game/versus/verify-versus.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-versus.mjs --out <dir>");
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
say(`verify-versus: starting next dev on ${port}`);
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
async function goto(page, path) {
  for (let i = 0; ; i++) {
    try {
      return await page.goto(`${base}${path}`);
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. Twinkle, both copies played perfectly.
await goto(page, "/play?song=twinkle&input=test&versus=1&beat=off&stage=off");
await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
const chart = await page.evaluate(() => window.__pianoArcade.chart);
const p1 = chart.notes.filter((n) => n.id.startsWith("p1:"));
const p2 = chart.notes.filter((n) => n.id.startsWith("p2:"));
check(p1.length === 42 && p2.length === 42, `the chart holds both copies (${p1.length} + ${p2.length} notes)`);
check(p1.every((n) => n.pitch >= 60) && p2.every((n) => n.pitch < 60), "P1's notes sit at or above middle C, P2's below");
const mpb = 60000 / chart.bpm;
await page.evaluate((notes) => notes.forEach(([p, t]) => window.__pianoArcade.press(p, t)), chart.notes.map((n) => [n.pitch, n.beat * mpb]));
await page.waitForTimeout(6000);
await page.screenshot({ path: join(out, "versus-play.png") });
await page.getByTestId("versus").waitFor({ timeout: 120_000 });
check((await page.getByTestId("versus-winner").textContent()) === "DRAW", `the results say ${await page.getByTestId("versus-winner").textContent()}`);
for (const who of ["p1", "p2"]) {
  const text = await page.getByTestId(`versus-${who}`).textContent();
  check(text.includes("100.0%") && text.includes("42 PERFECT"), `${who.toUpperCase()}: ${text}`);
}
await page.getByTestId("versus").scrollIntoViewIfNeeded();
await page.screenshot({ path: join(out, "versus-results.png") });

// 2. A song that doesn't fit.
await goto(page, "/play?song=moonlight-3&versus=1");
await page.getByTestId("versus-refused").waitFor({ timeout: 60_000 });
check(true, "Moonlight's start screen says it doesn't fit versus");

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-versus.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-versus: ${failures.length} failed` : "verify-versus: all checks passed");
process.exit(failures.length ? 1 : 0);
