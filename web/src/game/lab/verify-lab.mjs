// Headless proof of the lab (spec: lab, Validation). Its own `next dev`:
// 1. / -> the footer's "Lab" link opens /lab, and so does X.
// 2. /lab -> every entry's page answers 200 and throws no page error.
// 3. lab-1280.png and lab-1920.png, and whether /lab scrolls at each size.
// Usage: node web/src/game/lab/verify-lab.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-lab.mjs --out <dir>");
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
say(`verify-lab: starting next dev on ${port}`);
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
try {
  // 1. The way in.
  let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await goto(page, "/");
  const link = page.getByTestId("lab-link");
  await link.waitFor({ timeout: 60_000 });
  await link.click();
  check(await page.waitForURL("**/lab", { timeout: 30_000 }).then(() => true, () => false), `/ -> the footer's Lab link opens /lab (${page.url()})`);
  await goto(page, "/");
  await page.getByTestId("lab-link").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500); // hydrated: the key handler is on
  await page.keyboard.press("x");
  check(await page.waitForURL("**/lab", { timeout: 30_000 }).then(() => true, () => false), `/ -> X opens /lab (${page.url()})`);
  const hrefs = await page.$$eval('[data-testid^="lab-"] a, a[data-testid^="lab-"]', (as) => as.map((a) => [a.dataset.testid, a.getAttribute("href")]));
  await page.close();

  // 2. Every entry's page loads.
  const entries = hrefs.filter(([id]) => id !== "lab-link");
  check(entries.length >= 10, `/lab lists ${entries.length} entries`);
  for (const [id, href] of entries) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    const res = await goto(p, href);
    await p.waitForTimeout(2500); // let the page's own scripts run
    check(res?.status() === 200 && errs.length === 0, `${id.slice(4)}: ${href} -> ${res?.status()}${errs.length ? `, page error: ${errs[0]}` : ""}`);
    await p.close();
  }

  // 3. The look, and the scroll, at both sizes.
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    page = await browser.newPage({ viewport: { width: w, height: h } });
    await goto(page, "/lab");
    await page.getByTestId("lab").waitFor({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const over = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    say(`verify-lab: ${w}×${h} ${over > 0 ? `scrolls ${over} px` : "fits, no page scroll"}`);
    check(over <= h, `${w}×${h}: at most one scroll (${Math.max(0, over)} px past the fold)`);
    await page.screenshot({ path: join(out, `lab-${w}.png`) });
    await page.close();
  }
} catch (e) {
  check(false, `error: ${e.message}`);
} finally {
  await browser.close();
}
say(failures.length ? `verify-lab: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-lab: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
