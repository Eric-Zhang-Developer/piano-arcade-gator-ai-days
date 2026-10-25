// Browser proof of record-moment (spec: record-moment, Validation): next dev, headless Chromium, Twinkle with the
// test hook, notes pressed as records/verify-records.mjs presses them. At 1280×720 and 1920×1080, each in a fresh profile:
// 1. A Perfect take -> the moment is in the viewport, no scroll, 3.5 s after the results show. E, R, I typed during
//    the reveal, then Enter -> `ERI · saved`, the top 5 has ERI, and Retry has the focus. Frames at 1.5, 2.0, 3.5 s.
// 2. A worse take -> no moment.
// 3. Reduced motion, a fresh profile, a Perfect take -> the moment shows with no running animation.
// Plus a 4 s video of step 1 at 1920×1080 from the results showing (trimmed with ffmpeg when it's installed).
// Usage: node web/src/game/record-moment/verify-moment.mjs --out <dir>
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-moment.mjs --out <dir>");
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
const url = `${base}/play?song=twinkle&input=test&beat=off&stage=off`;
say(`verify-moment: next dev on ${port}`);
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

// When the results screen appears, on the page's clock: the moment's times are measured from it.
const watchResults = () => {
  new MutationObserver((_, obs) => {
    if (document.querySelector('[data-testid="results"]')) {
      window.__resultsAt = performance.now();
      obs.disconnect();
    }
  }).observe(document, { subtree: true, childList: true });
};

// Plays Twinkle through the test hook, skipping the notes at the given indexes, until the results show.
async function take(page, skip = []) {
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(
    (notes) => notes.forEach(([pitch, t]) => window.__pianoArcade.press(pitch, t)),
    chart.notes.filter((_, i) => !skip.includes(i)).map((n) => [n.pitch, n.beat * mpb]),
  );
  await page.waitForFunction(() => window.__resultsAt !== undefined, null, { timeout: 120_000, polling: 5 });
}
const at = (page, ms) => page.waitForFunction((ms) => performance.now() >= window.__resultsAt + ms, ms, { timeout: 30_000, polling: 5 });
const inView = (page, testid) =>
  page.evaluate((testid) => {
    const el = document.querySelector(`[data-testid="${testid}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  }, testid);

for (const [w, h] of [
  [1280, 720],
  [1920, 1080],
]) {
  const size = `${w}x${h}`;
  const video = w === 1920;
  const context = await browser.newContext({ viewport: { width: w, height: h }, ...(video && { recordVideo: { dir: out, size: { width: w, height: h } } }) });
  await context.addInitScript(watchResults);
  const page = await context.newPage();
  const pageAt = Date.now();
  page.on("pageerror", (e) => errors.push(`${size}: ${e.message}`));

  // 1
  await take(page);
  for (const k of ["e", "r", "i"]) await page.keyboard.press(k); // during the reveal: before the stamp at 1.5 s
  const typedAt = await page.evaluate(() => performance.now() - window.__resultsAt);
  for (const ms of [1500, 2000, 3500]) {
    await at(page, ms);
    await page.screenshot({ path: join(out, `${size}-1-${ms}ms.png`) });
  }
  const scrollY = await page.evaluate(() => scrollY);
  const moment = await inView(page, "record-moment");
  const retryInView = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent === "Retry");
    const r = b?.getBoundingClientRect();
    return !!r && r.top >= 0 && r.bottom <= innerHeight;
  });
  check(moment && scrollY === 0 && retryInView, `${size} 1: at 3.5 s the moment and Retry are in the first view, no scroll (moment ${moment}, scrollY ${scrollY}, Retry ${retryInView})`);
  await page.keyboard.press("Enter");
  await page.getByTestId("initials-saved").waitFor({ timeout: 5000 }).catch(() => {});
  const saved = await page.getByTestId("record-moment").innerText().catch(() => "");
  const top = await page.getByTestId("top5-this-take").innerText().catch(() => "");
  const focus = await page.evaluate(() => document.activeElement?.textContent);
  check(/ERI · saved/.test(saved), `${size} 1: E, R, I typed at ${Math.round(typedAt)} ms, then Enter -> the moment reads "${saved.replace(/\s+/g, " ")}"`);
  check(/ERI/.test(top), `${size} 1: the top 5 has ERI (${top.replace(/\s+/g, " ")})`);
  check(focus === "Retry", `${size} 1: Retry has the focus (${focus})`);
  await page.screenshot({ path: join(out, `${size}-1-saved.png`) });
  const resultsEpoch = await page.evaluate(() => performance.timeOrigin + window.__resultsAt);

  // 2
  await take(page, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  await at(page, 2500);
  const count = await page.getByTestId("record-moment").count();
  check(count === 0, `${size} 2: a worse take -> no moment (${count})`);
  await page.screenshot({ path: join(out, `${size}-2-worse.png`) });
  await context.close();

  if (video) {
    const raw = await page.video().path();
    const full = join(out, `${size}-1-full.webm`);
    renameSync(raw, full);
    const from = Math.max(0, (resultsEpoch - pageAt) / 1000);
    try {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", from.toFixed(2), "-i", full, "-t", "4", join(out, `${size}-1-moment.webm`)]);
      say(`verify-moment: video ${size}-1-moment.webm, 4 s from the results (${from.toFixed(1)} s into the take)`);
    } catch {
      say(`verify-moment: no ffmpeg: the whole take is ${size}-1-full.webm; the results show ${from.toFixed(1)} s in`);
    }
  }

  // 3
  const still = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await still.addInitScript(watchResults);
  const p3 = await still.newPage();
  p3.on("pageerror", (e) => errors.push(`${size} reduced: ${e.message}`));
  await take(p3);
  await p3.getByTestId("record-moment").waitFor({ timeout: 10_000 });
  await at(p3, 200);
  const running = await p3.getByTestId("record-moment").evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length);
  const opacity = await p3.getByTestId("new-record").evaluate((el) => getComputedStyle(el).opacity);
  check(running === 0 && opacity === "1", `${size} 3: reduced motion -> the moment shows at once, no running animation (${running} running, NEW RECORD opacity ${opacity})`);
  await p3.screenshot({ path: join(out, `${size}-3-reduced.png`) });
  await still.close();
}

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-moment.json"), JSON.stringify({ failures }, null, 2));
await browser.close();
say(`verify-moment: screenshots in ${out}`);
say(failures.length ? `verify-moment: ${failures.length} failed` : "verify-moment: pass");
process.exit(failures.length ? 1 : 0);
