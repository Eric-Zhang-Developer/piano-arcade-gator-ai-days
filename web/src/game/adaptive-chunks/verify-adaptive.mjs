// Headless proof of adaptive chunks on Twinkle (spec: adaptive-chunks, Validation 2). Starts its own dev server.
// 1. A plain take's "Practice in chunks" opens the whole song at 70% (practice=adapt), reading "Practice · whole song ·
//    clean 0 of 2".
// 2. A rank-D take focuses "Smaller: …", which halves the window; on a 2-phrase window, a perfect take focuses
//    "Again: clean 1 of 2", and a second one focuses "Next: …", which grows it.
// 3. The strip after each step at 1280×720 and 1920×1080, as numbered PNGs, with no page scroll.
// Usage: node web/src/game/adaptive-chunks/verify-adaptive.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-adaptive.mjs --out <dir>");
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
say(`verify-adaptive: starting next dev on ${port}`);
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
const off = "beat=off&stage=off";

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
const query = (url) => new URL(url, base).searchParams;
const params = (url) => [...query(url)].filter(([k]) => !["beat", "stage", "input", "bot"].includes(k)).map(([k, v]) => `${k}=${v}`).join("&");
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
const bars = (url) => Number(query(url).get("to")) - Number(query(url).get("from")) + 1;
// No page scroll: the document is no taller than the window, and nothing scrolled it (focus included).
const noScroll = (page) => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && scrollY === 0);

// A bot plays the step to the end; the results screen comes back.
async function botTake(page, path, bot) {
  await goto(page, `${path}&bot=${bot}&${off}`);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(3000); // effects after mount (focus), and the full-combo banner gone before the shot
}

const browser = await chromium.launch({ headless: true });
const errors = [];
for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.message));
  const size = `${w}x${h}`;
  let shot = 0;
  const strip = async (what) => {
    shot++;
    await page.getByTestId("adapt-strip").first().waitFor({ timeout: 30_000 });
    await page.screenshot({ path: join(out, `strip-${shot}-${size}.png`) });
    check(await noScroll(page), `${size} strip-${shot} (${what}): no page scroll`);
  };

  // 1. The way in.
  await goto(page, `/play?song=twinkle&${off}`);
  await page.getByTestId("chunk-start").waitFor({ timeout: 60_000 });
  await page.getByTestId("chunk-start").click();
  await page.getByTestId("adapt-line").waitFor({ timeout: 60_000 });
  const startUrl = page.url();
  check(params(startUrl) === "song=twinkle&from=1&to=12&tempo=70&passes=1&practice=adapt&ok=0&ko=0&clean=0", `${size} "Practice in chunks" opens ${params(startUrl)}`);
  const line = await page.getByTestId("adapt-line").textContent();
  check(line === "Practice · whole song · clean 0 of 2", `${size} the start screen reads "${line}"`);
  const hook = await page.evaluate(() => window.__pianoArcadeAdapt);
  check(hook?.from === 1 && hook.to === 12 && hook.phrases?.length === 6, `${size} __pianoArcadeAdapt is ${JSON.stringify(hook && { ...hook, phrases: hook.phrases.length })}`);
  await strip("start, whole song");

  // 2a. A failing take halves the window.
  await botTake(page, startUrl.replace(base, ""), "rank-d");
  const smaller = page.getByTestId("adapt-next");
  const smallerText = await smaller.textContent();
  const smallerHref = await smaller.getAttribute("href");
  check(/^Smaller: bars \d+–\d+$/.test(smallerText ?? ""), `${size} rank-D: "${smallerText}"`);
  check((await focused(page)) === "adapt-next", `${size} rank-D: it has focus`);
  check(bars(smallerHref) === 6, `${size} rank-D: the window halves to ${bars(smallerHref)} bars of 12 (${params(smallerHref)})`);
  await strip("after rank-D");

  // 2b. Two perfect takes on a 2-phrase window: again, then grow.
  const two = "/play?song=twinkle&from=1&to=4&tempo=70&passes=1&practice=adapt&ok=0&ko=0&clean=0";
  await botTake(page, two, "perfect");
  const again = page.getByTestId("adapt-next");
  const againText = await again.textContent();
  check(againText === "Again: clean 1 of 2", `${size} first perfect take: "${againText}"`);
  check((await focused(page)) === "adapt-next", `${size} first perfect take: it has focus`);
  const againHref = await again.getAttribute("href");
  await strip("after a perfect take, clean 1");

  await botTake(page, againHref, "perfect");
  const grow = page.getByTestId("adapt-next");
  const growText = await grow.textContent();
  const growHref = await grow.getAttribute("href");
  check(/^Next: bars \d+–\d+$/.test(growText ?? ""), `${size} second perfect take: "${growText}"`);
  check((await focused(page)) === "adapt-next", `${size} second perfect take: it has focus`);
  check(bars(growHref) === 8 && query(growHref).get("ok") === "2", `${size} the window grows to ${bars(growHref)} bars, ok ${query(growHref).get("ok")} (${params(growHref)})`);
  await strip("after the grow");
  await page.close();
}
await browser.close();
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-adaptive: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-adaptive: pass (evidence: ${out})`);
process.exit(0);
