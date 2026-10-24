// Headless proof of records (spec: records, the Chrome steps): in one fresh browser profile, a perfect Twinkle shows
// NEW RECORD and takes initials typed on the keyboard; a worse take shows no NEW RECORD but lands in the top 5 and
// keeps "---" when the player leaves without Enter; a ?bot=perfect take isn't recorded.
// Usage: node web/src/game/dynamics/verify-records.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-records.mjs --out <dir>");
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
say(`verify-records: starting next dev on ${port}`);
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

// Plays Twinkle through the test hook, skipping the notes at the given indexes, and waits for the records panel.
async function take(page, skip = []) {
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(
    (notes) => notes.forEach(([pitch, t]) => window.__pianoArcade.press(pitch, t)),
    chart.notes.filter((_, i) => !skip.includes(i)).map((n) => [n.pitch, n.beat * mpb]),
  );
  await page.getByTestId("records").waitFor({ timeout: 120_000 });
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("pianoArcade.records") ?? "{}"));

const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const fail = [];

  // 1. A perfect take: NEW RECORD, then initials E, R, I with I nudged up to J, then Backspace and I again, then Enter.
  await take(page);
  if (!(await page.getByTestId("new-record").isVisible())) fail.push("1: no NEW RECORD on the first take");
  for (const k of ["e", "r", "i", "ArrowUp", "Backspace", "i", "Enter"]) await page.keyboard.press(k);
  await page.getByTestId("top5-this-take").screenshot({ path: join(out, "top5-first.png") });
  await page.getByTestId("records").screenshot({ path: join(out, "records-first.png") });
  const s1 = await stored(page);
  const still = await page.getByTestId("results").isVisible(); // Enter saved initials, it didn't press Retry
  say(`verify-records: take 1 -> NEW RECORD, initials ${s1.twinkle?.top?.[0]?.initials}, best ${s1.twinkle?.best?.rank}`);
  if (s1.twinkle?.top?.[0]?.initials !== "ERI") fail.push(`1: initials ${JSON.stringify(s1.twinkle?.top)}`);
  if (!still) fail.push("1: Enter left the results screen (pressed Retry?)");

  // 2. A worse take (10 notes skipped): no NEW RECORD, in the top 5 as #2, and "---" after leaving without Enter.
  await take(page, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
  const newRecord2 = await page.getByTestId("new-record").count();
  const entry2 = await page.getByTestId("initials-entry").count();
  await page.getByTestId("records").screenshot({ path: join(out, "records-second.png") });
  await page.goto(`${base}/`);
  const s2 = await stored(page);
  // Song select: Twinkle's card shows the best grade (take 1's S at 100%), and no other card shows one.
  const bestText = (await page.getByTestId("song-twinkle").locator('[data-testid="best"]').innerText()).replace(/\s+/g, " ");
  const bestCards = await page.locator('[data-testid="best"]').count();
  say(`verify-records: song select -> Twinkle "${bestText}", ${bestCards} card(s) with a grade`);
  if (!/BEST 100\.0% S/i.test(bestText) || bestCards !== 1) fail.push(`song select: "${bestText}" on ${bestCards} cards`);
  await page.screenshot({ path: join(out, "song-select.png") });
  const top = s2.twinkle?.top ?? [];
  say(`verify-records: take 2 -> NEW RECORD shown ${newRecord2 > 0}, top 5 ${top.map((t) => `${t.initials} ${t.score}`).join(", ")}`);
  if (newRecord2) fail.push("2: NEW RECORD on a worse take");
  if (!entry2) fail.push("2: no initials entry for a top-5 take");
  if (top.length !== 2 || top[1].initials !== "---" || top[0].initials !== "ERI") fail.push(`2: top 5 ${JSON.stringify(top)}`);
  if (s2.twinkle?.best?.score !== s1.twinkle?.best?.score) fail.push("2: the best grade changed on a worse take");

  // 3. A bot take isn't recorded.
  await page.goto(`${base}/play?song=twinkle&bot=perfect&beat=off&stage=off`);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves
  await page.getByTestId("records").waitFor({ timeout: 120_000 });
  const text3 = await page.getByTestId("records").innerText();
  const s3 = await stored(page);
  say(`verify-records: take 3 (?bot=perfect) -> "${text3}", entries ${s3.twinkle?.top?.length}`);
  if (!/Practice takes aren.t recorded/.test(text3)) fail.push(`3: panel says "${text3}"`);
  if (s3.twinkle?.top?.length !== 2) fail.push("3: the bot take was recorded");

  fail.push(...errors);
  writeFileSync(join(out, "records.json"), JSON.stringify({ s1, s2, s3 }, null, 2));
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-records: pass (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-records: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
