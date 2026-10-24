// Headless proof of the phone guard (spec: phone-guard):
//   1. iPhone 13, Pixel 7 and iPad Pro 11 landscape, on / and /play?song=twinkle: the card covers the viewport, "See
//      the code" links the repo, no video link while its URL is empty, the first link has focus.
//   2. iPhone: Play anyway -> gone; reload -> still gone; a new context -> back.
//   3. A laptop (no touch) at 1280×720 and 1920×1080, on / and /play: the card's display is none, and on / the first
//      song card has focus.
//   4. /calibrate on the iPhone: no card.
// Usage: node web/src/game/phone-guard/verify-phone.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const REPO = "https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days";
const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-phone.mjs --out <dir>");
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
say(`verify-phone: starting next dev on ${port}`);
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
// The card's state, read in the page: shown, covering the viewport, its links, and what has focus.
const state = (page) =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="phone-guard"]');
    const r = g?.getBoundingClientRect();
    const links = g ? [...g.querySelectorAll("a")].map((a) => ({ text: a.textContent, href: a.href })) : [];
    return {
      present: !!g,
      display: g ? getComputedStyle(g).display : null,
      covers: !!r && r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight,
      links,
      focusInCard: !!g && g.contains(document.activeElement) && document.activeElement === g.querySelector("a"),
      focusFirstSong: document.activeElement === document.querySelector('[data-testid^="song-"]'),
    };
  });
const settle = (page) => page.waitForTimeout(1500); // hydration and the focus effect

// Playwright's device, minus its browser type: the check runs them all in Chromium.
const chromiumDevice = (name) => {
  const d = { ...devices[name] };
  delete d.defaultBrowserType;
  return d;
};
const browser = await chromium.launch({ headless: true });
const errors = [];
const context = async (opts) => {
  const c = await browser.newContext(opts);
  c.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  return c;
};
try {
  // 1. Phones and a tablet.
  for (const name of ["iPhone 13", "Pixel 7", "iPad Pro 11 landscape"]) {
    const c = await context(chromiumDevice(name));
    const page = await c.newPage();
    for (const path of ["/", "/play?song=twinkle"]) {
      await goto(page, path);
      await page.getByTestId("phone-guard").waitFor({ timeout: 60_000 }).catch(() => {});
      await settle(page);
      const s = await state(page);
      const code = s.links.find((l) => l.text === "See the code");
      check(s.display !== "none" && s.covers, `${name} ${path}: the card covers the viewport (display ${s.display})`);
      check(code?.href === REPO && !s.links.some((l) => /video/i.test(l.text)), `${name} ${path}: "See the code" -> ${code?.href}, no video link`);
      check(s.focusInCard, `${name} ${path}: the first link has focus`);
      await page.screenshot({ path: join(out, `${name.replace(/ /g, "-")}${path === "/" ? "-select" : "-play"}.png`) });
    }
    await c.close();
  }

  // 2. Play anyway lasts for the tab.
  const iphone = chromiumDevice("iPhone 13");
  let c = await context(iphone);
  let page = await c.newPage();
  await goto(page, "/play?song=twinkle");
  await page.getByRole("button", { name: "Play anyway" }).click({ timeout: 60_000 });
  check((await state(page)).display === "none", "iPhone: Play anyway -> the card is gone");
  await page.reload();
  await settle(page);
  check((await state(page)).display === "none", "iPhone: reload -> still gone");
  await c.close();
  c = await context(iphone);
  page = await c.newPage();
  await goto(page, "/play?song=twinkle");
  await settle(page);
  check((await state(page)).display !== "none", "iPhone: a new context -> the card is back");

  // 4. Other routes never show it.
  await goto(page, "/calibrate");
  await settle(page);
  check(!(await state(page)).present, "iPhone /calibrate: no card");
  await c.close();

  // 3. Laptops: one hidden element, nothing else changes.
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    c = await context({ viewport: { width: w, height: h } });
    page = await c.newPage();
    for (const path of ["/", "/play?song=twinkle"]) {
      await goto(page, path);
      await settle(page);
      const s = await state(page);
      check(s.present && s.display === "none", `laptop ${w}×${h} ${path}: the card is in the DOM, display ${s.display}`);
      if (path === "/") check(s.focusFirstSong, `laptop ${w}×${h} /: the first song card has focus`);
      await page.screenshot({ path: join(out, `laptop-${w}x${h}${path === "/" ? "-select" : "-play"}.png`) });
    }
    await c.close();
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
} catch (e) {
  check(false, `threw: ${e.message}`);
} finally {
  await browser.close();
}
writeFileSync(join(out, "phone.json"), JSON.stringify({ failures }, null, 2));
say(failures.length ? `verify-phone: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-phone: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
