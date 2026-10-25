// Headless proof of song-sources (spec: song-sources, Validation). Starts its own dev server; prints
// `verify-sources: pass` and exits 0, or names each failure and exits 1:
// 1. On /, focus each song card in turn (↓): preview-source's href is that chart's first non-license URL, and its text
//    starts with "Source: ".
// 2. A click on Twinkle's link opens a new page at the Wikipedia URL (routed to a stub, so it works offline).
// 3. Screenshots of the focused column at 1280×720 and 1920×1080, and with reduced motion.
// Usage: node web/src/game/song-sources/verify-sources.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// select-calm (#1411): Learn, Flow, the level, Hands, Speed and the source sit in the Practice panel; open it first.
const openPractice = async (p) => {
  const b = p.getByTestId("practice-open");
  await b.waitFor({ timeout: 60_000 });
  if ((await b.getAttribute("aria-expanded")) !== "true") await b.click();
};

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-sources.mjs --out <dir>");
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
say(`verify-sources: starting next dev on ${port}`);
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
      await page.goto(`${base}${path}`);
      return;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}

// The check's own reading of the spec, not sourceLink's: the first http(s) URL, up to whitespace or ")", that isn't
// on creativecommons.org.
const firstScoreUrl = (source) => (source.match(/https?:\/\/[^\s)]+/g) ?? []).find((u) => !/(^|\.)creativecommons\.org$/.test(new URL(u).hostname)) ?? null;

const browser = await chromium.launch({ headless: true });
const errors = [];
for (const [w, h, reducedMotion] of [
  [1280, 720],
  [1920, 1080],
  [1920, 1080, "reduce"],
]) {
  const size = `${w}x${h}${reducedMotion ? "-reduced" : ""}`;
  const first = w === 1280; // every check once; the other sizes for screenshots
  const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion });
  await context.route("https://en.wikipedia.org/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>stub</title>wikipedia stub" }));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await goto(page, "/");
  const cards = page.locator('ol a[data-testid^="song-"]');
  await cards.first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(300); // hydration
  if (first) {
    // 1. Each card's source line.
    const ids = await cards.evaluateAll((as) => as.map((a) => a.dataset.testid.slice("song-".length)));
    await cards.first().focus();
    for (const [i, id] of ids.entries()) {
      if (i > 0) await page.keyboard.press("ArrowDown");
      const source = await page.evaluate(async (id) => (await (await fetch(`/songs/${id}/chart.json`)).json()).source, id);
      const want = firstScoreUrl(source);
      const link = page.locator(`[data-testid="song-preview"] [data-testid="preview-source"]`);
      const got = await page
        .waitForFunction((want) => document.querySelector('[data-testid="preview-source"]')?.getAttribute("href") === want, want, { timeout: 10_000 })
        .then(() => true, () => false);
      const text = (await link.textContent().catch(() => "")) ?? "";
      const href = await link.getAttribute("href").catch(() => null);
      check(got && text.startsWith("Source: "), `${id}: "${text}" -> ${href}`);
    }
    // 2. Twinkle's link opens Wikipedia in a new page.
    await goto(page, "/");
    await cards.first().waitFor({ timeout: 60_000 });
    await openPractice(page);
    await page.getByTestId("song-twinkle").focus();
    const link = page.locator('[data-testid="preview-source"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="preview-source"]')?.getAttribute("href")?.includes("wikipedia.org"), null, { timeout: 10_000 });
    const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await popup.waitForLoadState();
    check(popup.url().startsWith("https://en.wikipedia.org/") && popup.url().includes("oldid=1378689555"), `Twinkle's click opens ${popup.url()}`);
    await popup.close();
  }
  // 3. The focused column.
  await goto(page, "/");
  await cards.first().waitFor({ timeout: 60_000 });
  await openPractice(page);
  await page.getByTestId("song-twinkle").focus();
  await page.locator('[data-testid="preview-source"]').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `select-${size}.png`) });
  await context.close();
}
await browser.close();
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-sources: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-sources: pass (evidence: ${out})`);
process.exit(0);
