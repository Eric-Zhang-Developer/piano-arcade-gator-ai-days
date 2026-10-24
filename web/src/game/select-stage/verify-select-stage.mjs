// Browser proof of select-stage (spec: select-stage, Validation): a production build in headless Chromium at 1280×720
// and 1920×1080. An init script keeps every WebGL context getContext returns; live means !isContextLost().
// 1. / has one canvas in select-stage and one live context; ↑/↓ moves the focus; a card click opens /play; back.
// 2. Enter on / opens /play's start screen with 0 live contexts; Start -> 1; back to / -> 1.
// 3. / and /?stage=off differ, and /?stage=off has no canvas.  4. Two shots 500 ms apart differ.
// 5. Under reduced motion two shots 500 ms apart are identical.  6. Under reduced motion each off-card text item has at
// least 4.5:1 against the 95th-percentile-luminance pixel behind it, and the page doesn't scroll.
// On a Mac, WebGL draws on the GPU (Metal): in software GL fever-stage's frame guard trips (perf-budget's finding).
// Usage: node web/src/game/select-stage/verify-select-stage.mjs --out <dir> [--no-build]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-select-stage.mjs --out <dir> [--no-build]");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

if (!process.argv.includes("--no-build")) {
  say("verify-select-stage: next build");
  const b = spawnSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  if (b.status !== 0) {
    say("verify-select-stage: the build failed");
    process.exit(1);
  }
}
const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(webDir, "node_modules/.bin/next"), ["start", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
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

// Keeps every WebGL context, so a context the page dropped but never lost still counts as live.
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

// Off-card text the select shows: [name, selector]. Every match with text is checked.
const TEXT = [
  ["wordmark", "main header h1"],
  ["hint", "main header p"],
  ["hint keys", "main header p b"],
  ["title", "main section h2"],
  ["composer", "main section h2 + p"],
  ["stats label", "main section dl dt"],
  ["stats value", "main section dl dd"],
  ["preview row", "[data-testid=song-preview] span span, [data-testid=song-preview] b, [data-testid=song-preview] a"],
  ["preview status", "[data-testid=preview-status]"],
  ["Calibrate", 'a[href="/calibrate"]'],
];

const gpu = process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [];
const browser = await chromium.launch({ headless: true, args: gpu });

async function open(context, path) {
  const page = await context.newPage();
  page.on("console", (m) => {
    if (/frozen/.test(m.text())) say(`note: ${m.text()}`);
  });
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the server is still starting
    }
  }
  await page.locator("ol a").first().waitFor({ timeout: 30_000 });
  return page;
}

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
]) {
  const tag = `${width}x${height}`;
  const viewport = { width, height };

  // 1 and 2: contexts across / -> /play -> /.
  let context = await browser.newContext({ viewport });
  await context.addInitScript(keepContexts);
  let page = await open(context, "/");
  await page.locator("[data-testid=select-stage] canvas").waitFor({ timeout: 10_000 });
  check((await page.locator("[data-testid=select-stage] canvas").count()) === 1, `${tag} 1: one canvas in select-stage`);
  check((await page.evaluate(() => window.__liveContexts())) === 1, `${tag} 1: one live WebGL context on /`);
  await page.locator("ol a").first().focus();
  await page.keyboard.press("ArrowDown");
  const second = await page.evaluate(() => document.activeElement === document.querySelectorAll("ol a")[1]);
  check(second, `${tag} 1: ↓ moves the focus to the second card`);
  await page.locator("ol a").nth(1).click();
  await page.waitForURL(/\/play\?/, { timeout: 30_000 });
  await page.goBack();
  await page.locator("ol a").first().waitFor({ timeout: 30_000 });
  check(true, `${tag} 1: a card click opens /play, and back returns to /`);

  await page.locator("ol a").first().focus();
  await page.keyboard.press("Enter");
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 30_000 });
  check((await page.evaluate(() => window.__liveContexts())) === 0, `${tag} 2: /play's start screen has 0 live contexts`);
  await start.click();
  await page.waitForTimeout(1500);
  check((await page.evaluate(() => window.__liveContexts())) === 1, `${tag} 2: after Start, 1 live context`);
  await page.goBack();
  await page.locator("[data-testid=select-stage] canvas").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  check((await page.evaluate(() => window.__liveContexts())) === 1, `${tag} 2: back on /, 1 live context`);
  await context.close();

  // 3 and 4: on and off, and motion.
  context = await browser.newContext({ viewport });
  page = await open(context, "/");
  await page.waitForTimeout(1500);
  const on = await page.screenshot({ path: join(out, `select-${tag}.png`) });
  await page.waitForTimeout(500);
  const later = await page.screenshot();
  check(!on.equals(later), `${tag} 4: two shots 500 ms apart differ`);
  const offPage = await open(context, "/?stage=off");
  await offPage.waitForTimeout(1500);
  const off = await offPage.screenshot({ path: join(out, `select-off-${tag}.png`) });
  check((await offPage.locator("[data-testid=select-stage] canvas").count()) === 0, `${tag} 3: /?stage=off has no canvas`);
  check(!on.equals(off), `${tag} 3: / and /?stage=off differ`);
  await context.close();

  // 5 and 6: reduced motion.
  context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  page = await open(context, "/");
  await page.waitForTimeout(1500);
  const still = await page.screenshot({ path: join(out, `select-reduced-${tag}.png`) });
  await page.waitForTimeout(500);
  check(still.equals(await page.screenshot()), `${tag} 5: under reduced motion, two shots 500 ms apart are identical`);

  const items = await page.evaluate((text) => {
    const found = [];
    for (const [name, sel] of text)
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (!el.textContent.trim() || r.width < 1 || r.height < 1) continue;
        found.push({ name, text: el.textContent.trim().slice(0, 24), color: getComputedStyle(el).color, box: [r.x, r.y, r.width, r.height] });
        el.style.setProperty("color", "transparent", "important");
      }
    for (const el of document.querySelectorAll(text.map((t) => t[1]).join(", ")))
      for (const d of el.querySelectorAll("*")) d.style.setProperty("color", "transparent", "important");
    return found;
  }, TEXT);
  const behind = (await page.screenshot()).toString("base64");
  const ratios = await page.evaluate(
    async ({ png, items }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const c = document.createElement("canvas");
      [c.width, c.height] = [img.width, img.height];
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g2, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g2 / 255) + 0.0722 * lin(b / 255);
      return items.map(({ name, text, color, box }) => {
        const [x, y, w, h] = box.map(Math.round);
        const d = g.getImageData(Math.max(0, x), Math.max(0, y), Math.max(1, w), Math.max(1, h)).data;
        const px = [];
        for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
        px.sort((a, b) => lum(a) - lum(b));
        const bg = px[Math.min(px.length - 1, Math.ceil(0.95 * px.length) - 1)];
        const m = color.match(/[\d.]+/g).map(Number);
        const a = m[3] ?? 1;
        const fg = [0, 1, 2].map((i) => a * m[i] + (1 - a) * bg[i]);
        const [hi, lo] = [lum(fg), lum(bg)].sort((p, q) => q - p);
        return { name, text, ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100, bg };
      });
    },
    { png: behind, items },
  );
  for (const r of ratios) check(r.ratio >= 4.5, `${tag} 6: ${r.name} "${r.text}" ${r.ratio}:1`);
  const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  check(fits, `${tag} 6: no page scroll`);
  await context.close();
}

writeFileSync(join(out, "verify-select-stage.json"), JSON.stringify({ failures }, null, 2));
await browser.close();
say(`verify-select-stage: screenshots in ${out}`);
say(failures.length ? `verify-select-stage: ${failures.length} failed` : "verify-select-stage: pass");
process.exit(failures.length ? 1 : 0);
