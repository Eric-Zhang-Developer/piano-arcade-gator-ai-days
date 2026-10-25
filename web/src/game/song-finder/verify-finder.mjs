// Headless proof of song-finder (spec: song-finder, Validation). Starts its own dev server.
// 1. / lists the songs in Level order, as today.
// 2. Composer: the rows run by surname, and the Chopin songs sit together.
// 3. Typing "chopin" leaves only Chopin's songs, and the focused row is one of them.
// 4. "zzz" shows the no-match line; Clear brings every song back.
// 5. After a finished take of the last song in Level order, Recent puts it first.
// 6. A reload keeps Recent and empties the search box.
// 7. Typing "p" in the search box starts no practice.
// Screenshots at 1280×720 and 1920×1080.
// Usage: node web/src/game/song-finder/verify-finder.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-finder.mjs --out <dir>");
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
say(`verify-finder: starting next dev on ${port}`);
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

const surname = (composer) => composer.split("(")[0].trim().split(/\s+/).pop();

const browser = await chromium.launch({ headless: true });
const fail = [];
const check = (ok, what) => {
  say(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) fail.push(what);
};
try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(`${base}/`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  context.on("weberror", (e) => errors.push(e.error().message));
  const page = await context.newPage();
  const search = page.getByTestId("finder-search");
  const rows = () => page.$$eval('ol[aria-label="Songs"] a', (as) => as.map((a) => a.dataset.testid.replace(/^song-/, "")));
  // Each song's composer and level, from its chart, for checking the order the select shows.
  const meta = async (ids) =>
    Promise.all(ids.map(async (id) => ({ id, ...(await (await fetch(`${base}/songs/${id}/chart.json`)).json()) })));

  // 1. Level order: the server's list, unchanged.
  await page.goto(`${base}/`);
  await search.waitFor({ timeout: 60_000 });
  await page.evaluate(() => ["pianoArcade.songSort", "pianoArcade.lastPlayed"].forEach((k) => localStorage.removeItem(k)));
  await page.reload();
  await search.waitFor({ timeout: 60_000 });
  const level = await rows();
  check(level.length >= 20 && (await page.getByTestId("finder-sort").inputValue()) === "level", `Level is the default, ${level.length} songs`);
  await page.screenshot({ path: join(out, "level-1280.png") });

  // 2. Composer.
  await page.getByTestId("finder-sort").selectOption("composer");
  const byComposer = await meta(await rows());
  const names = byComposer.map((s) => surname(s.composer));
  check(names.every((n, i) => i === 0 || names[i - 1].localeCompare(n) <= 0), `Composer runs by surname (${[...new Set(names)].join(", ")})`);
  const chopin = names.flatMap((n, i) => (n === "Chopin" ? [i] : []));
  check(chopin.length >= 2 && chopin[chopin.length - 1] - chopin[0] === chopin.length - 1, `the ${chopin.length} Chopin songs sit together`);
  await page.screenshot({ path: join(out, "composer-1280.png") });

  // 3. Filter: "chopin".
  await search.fill("chopin");
  const shown = await meta(await rows());
  check(shown.length === chopin.length && shown.every((s) => surname(s.composer) === "Chopin"), `"chopin" leaves only Chopin's ${shown.length} songs`);
  const panelTitle = await page.locator("main h2").first().textContent().catch(() => "");
  check(shown.some((s) => panelTitle?.includes(s.title)), `the focused song is one of them (${panelTitle})`);
  // select-calm (#1411): the visible count is gone; the live line still says N of total.
  check((await page.getByTestId("finder-said").textContent())?.trim() === `${shown.length} of ${level.length} songs`, "the live line reads N of total");

  // 7. A typed p never starts practice.
  const before = page.url();
  await search.focus();
  await page.keyboard.type("p");
  await page.waitForTimeout(800);
  check(page.url() === before, `typing p in the search box stays on / (${page.url()})`);

  // 4. No match, then Clear.
  await search.fill("zzz");
  await page.getByTestId("finder-none").waitFor({ timeout: 5000 });
  check((await rows()).length === 0, "zzz shows the no-match line and no rows");
  await page.screenshot({ path: join(out, "none-1280.png") });
  await page.getByTestId("finder-clear").click();
  check((await rows()).length === level.length && (await search.inputValue()) === "", "Clear brings every song back");

  // 5. A finished take of the last song in Level order, then Recent.
  const last = level[level.length - 1];
  await page.goto(`${base}/play?song=${last}&input=test`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  const end = Math.max(...chart.notes.map((n) => n.beat + n.duration)) * mpb;
  await page.waitForSelector('[data-testid="results"]', { timeout: end + 30_000 });
  await page.goto(`${base}/`);
  await search.waitFor({ timeout: 60_000 });
  await page.getByTestId("finder-sort").selectOption("recent");
  const recent = await rows();
  check(recent[0] === last, `Recent puts ${last} first after its take (${recent[0]})`);

  // 6. A reload keeps the sort and empties the box.
  await search.fill("bach");
  await page.reload();
  await search.waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="finder-sort"]')?.value === "recent", null, { timeout: 10_000 }).catch(() => {});
  check((await page.getByTestId("finder-sort").inputValue()) === "recent", "a reload keeps Recent");
  check((await search.inputValue()) === "" && (await rows())[0] === last, "a reload empties the search box and keeps the order");
  // The browser autofocused the server's first row (Level order); focus must follow to the row the panel shows.
  const active = await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName);
  check(active === `song-${last}`, `after the reload, focus is on the panel's song, so Enter plays it (${active})`);

  // The finder at both sizes, Recent and filtered.
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.screenshot({ path: join(out, `recent-${w}.png`) });
    await search.fill("moon");
    await page.screenshot({ path: join(out, `moon-${w}.png`) });
    await search.fill("");
  }
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await context.close();
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
if (fail.length) {
  say("verify-finder: FAIL");
  for (const f of fail) say(`  ${f}`);
  process.exit(1);
}
say(`verify-finder: pass (evidence: ${out})`);
process.exit(0);
