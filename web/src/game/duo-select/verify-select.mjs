// Headless proof of duo-select (spec: duo-select, Validation 2): on /, every row draws its piano roll and there's no
// stage canvas; Enter, P and L open a judged take, adaptive practice and wait mode; a saved "next for you" shows its
// bars and an unsaved one shows nothing; screenshots at 1280×720, 1920×1080 and reduced motion, none scrolling.
// Prints "verify-select: pass" and exits 0, or names each failed step and exits 1.
// Usage: node web/src/game/duo-select/verify-select.mjs --out <dir>
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
  console.error("usage: verify-select.mjs --out <dir>");
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
say(`verify-select: starting next dev on ${port}`);
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
const params = (page) => new URL(page.url()).searchParams;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// / with the first row focused, as it loads.
async function home() {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}/`);
      break;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
  await page.locator("ol a").first().waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.activeElement?.matches("ol a"), null, { timeout: 10_000 });
}
// ↓ until the focused row is `id`; false if the list doesn't have it.
async function focus(id) {
  const ids = await page.locator("ol a").evaluateAll((as) => as.map((a) => new URL(a.href).searchParams.get("song")));
  const i = ids.indexOf(id);
  if (i < 0) return false;
  for (let k = 0; k < i; k++) await page.keyboard.press("ArrowDown");
  return page.evaluate((id) => new URL(document.activeElement.href).searchParams.get("song") === id, id);
}

// 1. Every row has its roll, and there's no stage.
await home();
const rows = await page.locator("ol a").evaluateAll((as) => as.map((a) => !!a.querySelector("canvas[data-piano-roll]")));
check(rows.length > 0 && rows.every(Boolean), `every row has a piano-roll canvas (${rows.filter(Boolean).length} of ${rows.length})`);
const stray = await page.evaluate(() => [...document.querySelectorAll("canvas")].filter((c) => !c.matches("[data-piano-roll]")).length);
check(stray === 0 && (await page.locator("[data-testid=select-stage]").count()) === 0, `no stage canvas (${stray} other canvases)`);
check(await page.getByTestId("focus-panel").locator("canvas[data-piano-roll]").isVisible(), "the focused panel draws the song's roll");
const first = await page.evaluate(() => new URL(document.activeElement.href).searchParams.get("song"));

// 2. Enter, P and L.
await page.keyboard.press("Enter");
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(params(page).get("song") === first && !params(page).has("practice") && !params(page).has("mode"), `Enter opens ${new URL(page.url()).search}, judged`);
await home();
await openPractice(page);
await page.getByTestId("select-practice").and(page.locator(":not([disabled])")).waitFor({ timeout: 30_000 });
await page.keyboard.press("p");
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(params(page).get("song") === first && params(page).get("practice") === "adapt" && params(page).get("mode") === "flow", `P opens ${new URL(page.url()).search} (want practice=adapt in Flow, play-modes)`);
await home();
await openPractice(page);
await page.getByTestId("select-practice").and(page.locator(":not([disabled])")).waitFor({ timeout: 30_000 });
await page.getByTestId("select-practice").click();
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(params(page).get("practice") === "adapt" && params(page).get("mode") === "flow", `PRACTICE opens ${new URL(page.url()).search} (want practice=adapt in Flow)`);
await home();
await page.keyboard.press("l");
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(params(page).get("song") === first && params(page).get("mode") === "wait", `L opens ${new URL(page.url()).search} (want mode=wait)`);
// mouse-first: LEARN as a rung in the Practice panel, the same as L. WATCH left the select for /play's start screen
// (select-calm, #1411): no button here.
await home();
await openPractice(page);
await page.getByTestId("select-learn").click();
await page.waitForURL(/\/play\?/, { timeout: 30_000 });
check(params(page).get("song") === first && params(page).get("mode") === "wait", `LEARN opens ${new URL(page.url()).search} (want mode=wait)`);
await home();
check((await page.getByTestId("select-watch").count()) === 0, "WATCH is off the select (select-calm: it's on /play's start screen)");

// 3. Next for you: none unsaved, the saved bars once seeded.
await home();
await page.evaluate(() => localStorage.removeItem("pianoArcade.nextFor.fur-elise"));
await home();
check(await focus("fur-elise"), "the list has Für Elise");
await page.waitForTimeout(300);
check((await page.getByTestId("next-for-you").count()) === 0, "with nothing saved, there's no Next for you strip");
await page.evaluate(() =>
  localStorage.setItem("pianoArcade.nextFor.fur-elise", JSON.stringify({ song: "fur-elise", from: 9, to: 12, hand: "L" })),
);
await home();
await focus("fur-elise");
const strip = page.getByTestId("next-for-you");
await strip.waitFor({ timeout: 10_000 }).catch(() => {});
const text = (await strip.count()) ? (await strip.textContent()).replace(/\s+/g, " ").trim() : "";
check(/bars 9–12/.test(text) && /left hand/.test(text), `seeded, the strip reads "${text}" (want bars 9–12, left hand)`);
await page.evaluate(() => localStorage.removeItem("pianoArcade.nextFor.fur-elise"));

// 4. Screenshots, no page scroll.
for (const [w, h, motion] of [
  [1280, 720, "no-preference"],
  [1920, 1080, "no-preference"],
  [1280, 720, "reduce"],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.emulateMedia({ reducedMotion: motion });
  await home();
  await page.waitForTimeout(500);
  const name = `select-${w}x${h}${motion === "reduce" ? "-reduce" : ""}.png`;
  await page.screenshot({ path: join(out, name) });
  const s = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth }));
  check(s.h <= h && s.w <= w, `${name}: no page scroll (${s.w}×${s.h})`);
}
say(`verify-select: screenshots in ${out}`);

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-select.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-select: ${failures.length} failed` : "verify-select: pass");
process.exit(failures.length ? 1 : 0);
