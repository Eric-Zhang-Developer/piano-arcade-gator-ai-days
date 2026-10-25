// Headless proof of the nav bar (spec: nav-bar, Validation 2). Its own `next dev`:
// 1. / shows the bar with Play current, in the kit's inks, clear of the wordmark and the build stamp.
// 2. Each slot's link answers 200 with no page error, and that page marks its own slot current.
// 3. /play?song=twinkle, /cabinet and /?capture=1 show no bar (nor /operator, Status's page).
// Also: the GitHub link opens the repo in a new tab.
// 4. nav-1280.png and nav-1920.png of /.
// Usage: node web/src/game/nav-bar/verify-nav.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-nav.mjs --out <dir>");
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
say(`verify-nav: starting next dev on ${port}`);
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

const shown = (page) => page.getByTestId("nav-bar").isVisible();
const current = (page) => page.$$eval('[data-testid="nav-bar"] a[aria-current="page"]', (as) => as.map((a) => a.getAttribute("href")));
const overlap = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const browser = await chromium.launch({ headless: true });
try {
  // 1 and 4: / at both sizes.
  let hrefs = [];
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await goto(page, "/");
    await page.getByTestId("nav-bar").waitFor({ timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    check(JSON.stringify(await current(page)) === '["/"]', `${w}×${h} /: the bar shows, Play current (${await current(page)})`);
    const boxes = await page.evaluate(() => {
      const r = (el) => el && el.getBoundingClientRect().toJSON();
      const h1 = document.querySelector("h1");
      // The wordmark's É rises above its box: count its overflow, as drawn.
      const mark = h1 && { ...r(h1), top: r(h1).bottom - h1.scrollHeight };
      return { bar: r(document.querySelector('[data-testid="nav-bar"]')), mark, stamp: r(document.querySelector('[data-testid="build-stamp"]')) };
    });
    check(!overlap(boxes.bar, boxes.mark) && !overlap(boxes.bar, boxes.stamp), `${w}×${h} /: the bar clears the wordmark and the build stamp (bar ${Math.round(boxes.bar.left)}–${Math.round(boxes.bar.right)} × 0–${Math.round(boxes.bar.bottom)})`);
    // The labels take the kit's inks, not the link's default blue: dim off the current page, primary on it.
    const inks = await page.evaluate(() => {
      const ink = (v) => {
        const s = document.createElement("span");
        s.style.color = `var(${v})`;
        document.body.append(s);
        const c = getComputedStyle(s).color;
        s.remove();
        return c;
      };
      const [dim, primary] = [ink("--pa-ink-dim"), ink("--pa-primary")];
      return [...document.querySelectorAll('[data-testid="nav-bar"] a')].map((a) => getComputedStyle(a.firstElementChild).color === (a.getAttribute("aria-current") ? primary : dim));
    });
    check(inks.length > 0 && inks.every(Boolean), `${w}×${h} /: each label is dim ink, the current one primary (${inks})`);
    const repo = await page.$eval('[data-testid="nav-github"]', (a) => [a.href, a.target, a.rel].join(" ")).catch(() => "missing");
    check(repo === "https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days _blank noopener noreferrer", `${w}×${h} /: the GitHub link opens the repo in a new tab (${repo})`);
    hrefs = await page.$$eval('[data-testid="nav-bar"] a[data-testid^="nav-"]:not([data-testid="nav-github"])', (as) => as.map((a) => a.getAttribute("href")));
    await page.screenshot({ path: join(out, `nav-${w}.png`) });
    await page.close();
  }

  // 2. Each slot.
  for (const href of hrefs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    const res = await goto(page, href);
    await page.getByTestId("nav-bar").waitFor({ timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const cur = await current(page);
    // Status opens /operator, a screen the bar stays off: there it's enough that the page loads with no bar.
    const own = href === "/operator" ? !(await shown(page)) : cur.length === 1 && cur[0] === href;
    check(res?.status() === 200 && !errs.length && own, `${href} -> ${res?.status()}, current ${JSON.stringify(cur)}${errs.length ? `, page error: ${errs[0]}` : ""}`);
    await page.screenshot({ path: join(out, `slot${href.replaceAll("/", "-") || "-home"}.png`) });
    await page.close();
  }

  // 3. No bar.
  for (const path of ["/play?song=twinkle", "/cabinet", "/?capture=1"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await goto(page, path);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000); // hydration, and capture mode's attribute
    check(!(await shown(page)), `${path}: no bar`);
    await page.close();
  }
} catch (e) {
  check(false, `error: ${e.message}`);
} finally {
  await browser.close();
}
say(failures.length ? `verify-nav: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-nav: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
