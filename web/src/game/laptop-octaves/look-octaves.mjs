// Screenshots for laptop-octaves' Validation and Look pass (not a pass/fail check): next dev, Playwright, laptop keys.
// Für Elise: the start screen, then every 5 s of the take (the count-in, the right hand alone, both hands). Chopin:
// A held, then X and A held, so the lit key can be compared an octave apart.
// Usage: node web/src/game/laptop-octaves/look-octaves.mjs --out <dir> [--width 1920 --height 1080] [--reduced]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const arg = (name, d) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : d);
const out = resolve(arg("--out", "look-octaves"));
const width = Number(arg("--width", 1920));
const height = Number(arg("--height", 1080));
const reduced = process.argv.includes("--reduced");
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
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
process.on("exit", () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? "reduce" : "no-preference" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const open = async (song) => {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/play?song=${song}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the server is still starting
    }
  }
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  return start;
};
const tag = `${width}x${height}${reduced ? "-reduced" : ""}`;

let start = await open("fur-elise");
await page.screenshot({ path: join(out, `fur-elise-start-${tag}.png`) });
await start.click();
const t0 = Date.now();
for (const s of [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) {
  await page.waitForTimeout(Math.max(0, t0 + s * 1000 - Date.now()));
  await page.screenshot({ path: join(out, `fur-elise-${String(s).padStart(2, "0")}s-${tag}.png`) });
}
say(`look-octaves: Für Elise shots in ${out}`);

start = await open("chopin-prelude-4");
await start.click();
await page.waitForTimeout(1500);
await page.keyboard.down("a");
await page.waitForTimeout(150);
await page.screenshot({ path: join(out, `chopin-a-${tag}.png`) });
await page.keyboard.up("a");
await page.keyboard.press("x");
await page.waitForTimeout(150);
await page.keyboard.down("a");
await page.waitForTimeout(150);
await page.screenshot({ path: join(out, `chopin-x-a-${tag}.png`) });
await page.keyboard.up("a");
say(`look-octaves: Chopin shots in ${out}`);
say(errors.length ? `look-octaves: page errors: ${errors.join("; ")}` : "look-octaves: no page errors");
await browser.close();
process.exit(0);
