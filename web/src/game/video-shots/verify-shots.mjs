// Headless proof of video-shots (spec Validation 2): the two cards at 1920×1080 under ?capture=1, reduced motion, the
// first frames with the app's scripts blocked, and every shot-list URL on a committed song. A URL is clean when no
// [data-capture-hide] element has a box and the cursor is none; the same check on /?capture=0 must find one, so it can
// fail. Golden's rows (song=local/…) are skipped: their charts aren't in git.
// Usage: node web/src/game/video-shots/verify-shots.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-shots.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

// The shot list's URLs, as written. The montage row names its songs as <a, b, c…> and its bots as a range: each song
// once, with the perfect bot.
const shotList = readFileSync(join(webDir, "../specs/features/video-shots/shot-list.md"), "utf8");
const urls = [...new Set([...shotList.matchAll(/`(\/[^`]*capture=1[^`]*)`/g)].map((m) => m[1]))].flatMap((u) => {
  const songs = u.match(/song=<([^>]*)>/);
  if (!songs) return [u];
  return songs[1].split(/,\s*/).map((s) => s.replace(/…$/, "")).filter(Boolean)
    .map((s) => u.replace(songs[0], `song=${s}`).replace(/bot=<[^>]*>/, "bot=perfect"));
}).filter((u) => !u.includes("song=local/") && !u.includes("<"));

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-shots: starting next dev on ${port}`);
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
for (let end = Date.now() + 120_000; ; ) {
  if (Date.now() > end) throw new Error("server not ready after 120 s");
  if (await fetch(`${base}/shots`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

const fail = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) fail.push(line);
};
// What capture should have hidden but didn't (each element's opening tag), and body's cursor.
const leaks = (page) =>
  page.evaluate(() => ({
    shown: [...document.querySelectorAll("[data-capture-hide]")].filter((e) => e.getClientRects().length).map((e) => e.outerHTML.slice(0, 80)),
    cursor: getComputedStyle(document.body).cursor,
  }));
const settled = (page) => page.evaluate(() => document.getAnimations().every((a) => a.playState === "finished"));

const browser = await chromium.launch({ headless: true });
const results = {};
try {
  const view = { viewport: { width: 1920, height: 1080 } };
  const page = await browser.newPage(view);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 2.1: the title card.
  await page.goto(`${base}/shots?card=title&capture=1`);
  await page.waitForTimeout(2000);
  const title = await page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent,
    text: document.querySelector("main")?.innerText,
    // Every element that sets words directly, with its size.
    sizes: [...document.querySelectorAll("main *")]
      .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .map((e) => [e.textContent.trim().slice(0, 30), parseFloat(getComputedStyle(e).fontSize)]),
  }));
  await page.screenshot({ path: join(out, "title-1920.png") });
  check(title.h1 === "Étude", `title: the name is ${JSON.stringify(title.h1)}`);
  check(/hears every note,\s+and a reason to play one more time\./.test(title.text ?? ""), "title: the tagline as written");
  check(await settled(page), "title: still at 2 s");
  const small = title.sizes.filter(([, px]) => px < 24);
  check(small.length === 0, `title: every word at least 24 px${small.length ? ` (${JSON.stringify(small)})` : ""}`);
  const t = await leaks(page);
  check(!t.shown.length && t.cursor === "none", `title: no cursor, nav bar, stamp or chip${t.shown.length ? ` (${t.shown.join(", ")})` : ""}`);

  // 2.2: the end card, built with no NEXT_PUBLIC_LIVE_URL.
  await page.goto(`${base}/shots?card=end&capture=1`);
  await page.waitForTimeout(2000);
  const end = await page.evaluate(() => ({
    repo: document.querySelector('[data-testid="end-repo"]')?.textContent,
    live: !!document.querySelector('[data-testid="end-live"]'),
    pictures: document.querySelectorAll("main img, main canvas, main svg").length,
    empty: [...document.querySelectorAll("main p")].filter((p) => !p.textContent.trim()).length,
  }));
  await page.screenshot({ path: join(out, "end-1920.png") });
  check(end.repo === "github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days", `end: the repo URL (${end.repo})`);
  check(!end.live && !end.pictures && !end.empty, "end: no live URL, no QR and no empty box");
  check(await settled(page), "end: still at 2 s");

  // 2.3: reduced motion, the first frame is the 2 s frame.
  const calm = await browser.newPage({ ...view, reducedMotion: "reduce" });
  for (const card of ["title", "end"]) {
    await calm.goto(`${base}/shots?card=${card}&capture=1`);
    await calm.evaluate(() => document.fonts.ready);
    const first = await calm.screenshot();
    await calm.waitForTimeout(2000);
    const later = await calm.screenshot({ path: join(out, `${card}-reduced.png`) });
    check(first.equals(later), `${card}, reduced motion: the first frame equals the 2 s frame`);
  }
  await calm.close();

  // 2.4: the first frames, with the app's scripts blocked: only the server's HTML and the inline <head> script run.
  const bare = await browser.newPage(view);
  await bare.route("**/_next/static/chunks/**", (r) => r.abort());
  for (const u of ["/?capture=1", "/play?song=twinkle&capture=1", "/?capture=0"]) {
    await bare.goto(`${base}${u}`);
    const l = await leaks(bare);
    results[`no-js ${u}`] = l;
    if (u.endsWith("capture=0")) check(l.shown.length > 0, `no scripts, ${u}: capture's list shows without the flag, so the check can fail`);
    else check(!l.shown.length && l.cursor === "none", `no scripts, ${u}: nothing on capture's list${l.shown.length ? ` (${l.shown.join(", ")})` : ""}`);
  }
  await bare.close();

  // 2.5: every shot-list URL on a committed song.
  check(urls.length >= 5, `shot list: ${urls.length} URLs to check`);
  for (const u of urls) {
    await page.goto(`${base}${u}`);
    await page.waitForTimeout(1500);
    const l = await leaks(page);
    results[u] = l;
    check(!l.shown.length && l.cursor === "none", `${u}: nothing on capture's list${l.shown.length ? ` (${l.shown.join(", ")})` : ""}`);
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
  writeFileSync(join(out, "verify-shots.json"), JSON.stringify({ fail, title, end, results }, null, 2));
} finally {
  await browser.close();
}
say(fail.length ? `verify-shots: ${fail.length} failed` : `verify-shots: pass (evidence: ${out})`);
process.exit(fail.length ? 1 : 0);
