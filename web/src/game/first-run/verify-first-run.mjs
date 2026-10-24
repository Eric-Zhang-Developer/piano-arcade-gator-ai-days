// Browser proof of first-run (spec: first-run, Validation): next dev, headless Chromium, a fresh profile per size.
// At 1280×720 and 1920×1080:
// 1. / shows the link while the focus is still on song-twinkle, clear of the list, the focus panel and Options; ↓
//    still moves the list.
// 2. The link opens /play?song=twinkle&firstrun=1&labels=keys. With &input=test and every note on time, the cues show
//    fall, press, perfect, combo5, and the results screen shows. Screenshots of the link, the start line, cues 1–3 and
//    the results.
// 3. Once: on /, F opens the first-run URL; F with the Options drawer open doesn't. /play?song=twinkle&input=test
//    leaves __pianoArcadeFirstRun unset.
// Usage: node web/src/game/first-run/verify-first-run.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const FIRST_RUN = "/play?song=twinkle&firstrun=1&labels=keys";
const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-first-run.mjs --out <dir>");
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
say(`verify-first-run: next dev on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
process.on("exit", () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));
for (let i = 0; ; i++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 240) throw new Error("server not ready after 120 s");
  await new Promise((r) => setTimeout(r, 500));
}

const failures = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};
const browser = await chromium.launch({ headless: true });
const errors = [];

const activeId = (page) => page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName);
const overlaps = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const chartAt = (page, ms) => page.waitForFunction((t) => (window.__pianoArcade?.now?.() ?? -Infinity) >= t, ms, { timeout: 60_000, polling: 5 });

for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  const size = `${w}x${h}`;
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${size}: ${e.message}`));

  // 1
  await page.goto(base);
  const link = page.getByTestId("first-run-link");
  await link.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(500); // the select focuses its song after hydration
  const focused = await activeId(page);
  check(focused === "song-twinkle", `${size} 1: / shows the link while the focus is on song-twinkle (${focused})`);
  const box = await link.boundingBox();
  const others = {
    list: await page.locator("ol").first().boundingBox(),
    focus: await page.locator("section[aria-live]").first().boundingBox(),
    options: await page.getByTestId("options-open").boundingBox(),
  };
  const covered = Object.entries(others).filter(([, b]) => overlaps(box, b)).map(([k]) => k);
  check(box && covered.length === 0, `${size} 1: the link covers none of the list, the focus panel and Options${covered.length ? ` (covers ${covered.join(", ")})` : ""}`);
  await page.screenshot({ path: join(out, `${size}-link.png`) });
  await page.keyboard.press("ArrowDown");
  const moved = await activeId(page);
  check(moved !== focused && moved?.startsWith("song-"), `${size} 1: ↓ still moves the list (${focused} -> ${moved})`);

  // 2
  await link.click();
  await page.waitForURL((u) => u.searchParams.get("firstrun") === "1", { timeout: 60_000 });
  check(page.url() === base + FIRST_RUN, `${size} 2: the link opens ${FIRST_RUN} (${page.url().slice(base.length)})`);
  await page.getByTestId("first-run-start").waitFor({ timeout: 60_000 });
  check((await activeId(page)) === "BUTTON", `${size} 2: Start keeps its focus`);
  await page.screenshot({ path: join(out, `${size}-start.png`) });

  await page.goto(`${base}${FIRST_RUN}&input=test`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb + 5)), [chart.notes, 60000 / chart.bpm]);
  for (const [n, ms, id] of [
    [1, -4000, "fall"],
    [2, -1000, "press"],
    [3, 300, "perfect"],
  ]) {
    await chartAt(page, ms);
    await page.screenshot({ path: join(out, `${size}-cue${n}.png`) });
    const cue = await page.evaluate(() => window.__pianoArcadeFirstRun?.cue);
    check(cue === id, `${size} 2: cue ${n} at ${ms} ms is ${id} (${cue})`);
  }
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  const seen = await page.evaluate(() => window.__pianoArcadeFirstRun?.seen.join(","));
  check(seen === "fall,press,perfect,combo5", `${size} 2: seen ${seen}, and the results screen shows`);
  await page.screenshot({ path: join(out, `${size}-results.png`) });

  // 3, once
  if (w === 1280) {
    await page.goto(base);
    await page.getByTestId("first-run-link").waitFor();
    await page.waitForTimeout(500);
    await page.keyboard.press("f");
    await page.waitForURL((u) => u.searchParams.get("firstrun") === "1", { timeout: 30_000 }).catch(() => {});
    check(page.url() === base + FIRST_RUN, `3: F on / opens the first-run URL (${page.url().slice(base.length)})`);
    await page.goto(base);
    await page.getByTestId("options-open").click();
    await page.getByTestId("options").waitFor();
    await page.keyboard.press("f");
    await page.waitForTimeout(1500);
    check(new URL(page.url()).pathname === "/", `3: F with the Options drawer open stays on / (${page.url().slice(base.length)})`);
    await page.goto(`${base}/play?song=twinkle&input=test`);
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    await chartAt(page, -3000);
    check(await page.evaluate(() => window.__pianoArcadeFirstRun === undefined), "3: /play?song=twinkle&input=test leaves __pianoArcadeFirstRun unset");
  }
  await context.close();
}

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-first-run.json"), JSON.stringify({ failures }, null, 2));
await browser.close();
say(`verify-first-run: screenshots in ${out}`);
say(failures.length ? `verify-first-run: ${failures.length} failed` : "verify-first-run: pass");
process.exit(failures.length ? 1 : 0);
