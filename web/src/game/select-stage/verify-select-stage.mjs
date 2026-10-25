// Browser proof of select-stage (spec: select-stage, Validation) since the sun, grid and sky were retired (#728): the
// stage draws no scene, and /auth/login is the one page that mounts it. Headless Chromium at 1280×720 and 1920×1080.
// An init script keeps every WebGL context getContext returns; live means !isContextLost().
// 1. / mounts no select-stage and holds no live WebGL context (duo-select, #714).
// 2. /auth/login has one select-stage on --pa-bg, no canvas in it, and no live WebGL context. A screenshot of each size.
// Usage: node web/src/game/select-stage/verify-select-stage.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-select-stage.mjs --out <dir>");
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
say(`verify-select-stage: starting next dev on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], { cwd: webDir, detached: true, stdio: ["ignore", "ignore", "inherit"] });
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

const keepContexts = () => {
  const kept = [];
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const c = get.call(this, type, ...rest);
    if (c && /webgl/.test(type) && !kept.includes(c)) kept.push(c);
    return c;
  };
  window.__liveContexts = () => kept.filter((c) => !c.isContextLost()).length;
};

for (let end = Date.now() + 120_000; !(await fetch(base).then((r) => r.ok, () => false)); ) {
  if (Date.now() > end) throw new Error("the server didn't start in 120 s");
  await new Promise((r) => setTimeout(r, 500));
}
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1280, 720], [1920, 1080]]) {
    const tag = `${width}x${height}`;
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(keepContexts);
    const page = await context.newPage();

    await page.goto(`${base}/`);
    await page.locator("ol a").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    check((await page.locator("[data-testid=select-stage]").count()) === 0, `${tag} 1: / mounts no select-stage`);
    check((await page.evaluate(() => window.__liveContexts())) === 0, `${tag} 1: / holds no live WebGL context`);

    await page.goto(`${base}/auth/login`);
    const stage = page.locator("[data-testid=select-stage]");
    await stage.waitFor({ state: "attached", timeout: 60_000 });
    await page.waitForTimeout(1000);
    check((await stage.count()) === 1, `${tag} 2: /auth/login has one select-stage`);
    check((await stage.locator("canvas").count()) === 0, `${tag} 2: no canvas in it`);
    check((await page.evaluate(() => window.__liveContexts())) === 0, `${tag} 2: no live WebGL context`);
    const [bg, want] = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.background = "var(--pa-bg)";
      document.body.append(probe);
      const w = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return [getComputedStyle(document.querySelector("[data-testid=select-stage]")).backgroundColor, w];
    });
    check(bg === want, `${tag} 2: on --pa-bg (${bg})`);
    await page.screenshot({ path: join(out, `login-${tag}.png`) });
    await context.close();
  }
} catch (e) {
  check(false, `crashed: ${e.message}`);
} finally {
  await browser.close();
}

writeFileSync(join(out, "verify-select-stage.json"), JSON.stringify({ failures }, null, 2));
say(failures.length ? `verify-select-stage: ${failures.length} failed` : "verify-select-stage: pass");
process.exit(failures.length ? 1 : 0);
