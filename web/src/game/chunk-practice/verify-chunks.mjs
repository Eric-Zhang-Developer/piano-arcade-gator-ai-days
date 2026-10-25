// Headless proof of chunk practice on Twinkle, the spec's Validation steps: chunk 1's learn step, by its URL (the start
// screen's "Practice in chunks" opens adaptive-chunks' start since #601; verify-adaptive checks that link); a learned chunk's ladder Flow step (play-judged) opens the play step in Flow; a perfect play step
// focuses "Next: bars 5–8", a rank-D one shows "Learn bars 1–4 again" and leaves Retry focused; the last chunk leads
// to the whole song. Screenshots of the start line and both results panels at 1280×720 and 1920×1080.
// Usage: node web/src/game/chunk-practice/verify-chunks.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-chunks.mjs --out <dir>");
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
say(`verify-chunks: starting next dev on ${port}`);
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
const params = (page) => [...new URL(page.url()).searchParams].filter(([k]) => !["beat", "stage", "input", "bot"].includes(k)).map(([k, v]) => `${k}=${v}`).join("&");
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.textContent);

// A bot plays the step to the end; the results screen comes back.
async function botTake(page, path) {
  await goto(page, path);
  await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {}); // bots may start themselves
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(3000); // effects after mount, and the full-combo banner gone before the screenshot
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
  const first = w === 1280; // every check once; the larger size only for screenshots

  // 1. The fixed walk's first step, by its URL: practice=1 still works (adaptive-chunks' spec).
  await goto(page, `/play?song=twinkle&from=1&to=4&tempo=70&passes=1&mode=wait&practice=1&${off}`);
  await page.getByTestId("chunk-line").waitFor({ timeout: 60_000 });
  const line = await page.getByTestId("chunk-line").textContent();
  if (first) check(line === "Chunk 1 of 3 · learn", `the start screen reads "${line}"`);
  await page.screenshot({ path: join(out, `start-learn-${size}.png`) });

  if (first) {
    // 2. Learn it: every note pressed once the clock holds on it; the ladder's Flow step (play-judged, play-modes) opens
    // the play step in Flow, which follows the player's tempo, so it carries no tempo.
    await goto(page, `/play?song=twinkle&from=1&to=4&tempo=70&passes=1&mode=wait&practice=1&input=test&${off}`);
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    const chart = await page.evaluate(() => window.__pianoArcade.chart);
    const mpb = 60000 / chart.bpm;
    await page.evaluate(async (notes) => {
      const hook = window.__pianoArcade;
      for (const [p, t] of notes) {
        while (hook.now() < t) await new Promise(requestAnimationFrame);
        hook.press(p, t);
      }
    }, chart.notes.map((n) => [n.pitch, n.beat * mpb]));
    await page.getByTestId("results").waitFor({ timeout: 120_000 });
    await page.getByTestId("play-judged").click();
    await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
    const hook = await page.evaluate(() => window.__pianoArcadeChunk);
    const bpm = await page.evaluate(() => window.__pianoArcade.chart.bpm);
    check(params(page) === "song=twinkle&from=1&to=4&passes=1&mode=flow&practice=1", `the ladder's Flow step opens ${params(page)}`);
    check(hook?.step === "play" && hook.chunk === 1 && hook.of === 3, `__pianoArcadeChunk is ${JSON.stringify(hook)}`);
    check(bpm === 100, `the play step's bpm is ${bpm} (Twinkle's own: Flow takes no tempo)`);
  }

  // The play step's start line.
  await goto(page, `/play?song=twinkle&from=1&to=4&tempo=70&passes=1&practice=1&${off}`);
  await page.getByTestId("chunk-line").waitFor({ timeout: 60_000 });
  if (first) check((await page.getByTestId("chunk-line").textContent()) === "Chunk 1 of 3 · play at 70%", "the play step reads \"Chunk 1 of 3 · play at 70%\"");
  await page.screenshot({ path: join(out, `start-play-${size}.png`) });

  // 3. A perfect play step moves on; a rank-D one doesn't.
  await botTake(page, `/play?song=twinkle&from=1&to=4&tempo=70&passes=1&practice=1&bot=perfect&${off}`);
  if (first) {
    const next = page.getByTestId("chunk-next");
    check((await next.textContent()) === "Next: bars 5–8", `after a perfect take: "${await next.textContent()}"`);
    check((await focused(page)) === "chunk-next", `it has focus (${await focused(page)})`);
    const href = await next.getAttribute("href");
    const q = new URL(href, base).searchParams;
    const want = { song: "twinkle", from: "5", to: "8", tempo: "70", passes: "1", mode: "wait", practice: "1" };
    check(Object.entries(want).every(([k, v]) => q.get(k) === v), `it opens chunk 2's learn step (${href})`);
  }
  await page.screenshot({ path: join(out, `results-pass-${size}.png`) });

  await botTake(page, `/play?song=twinkle&from=1&to=4&tempo=70&passes=1&practice=1&bot=rank-d&${off}`);
  if (first) {
    const acc = await page.getByTestId("chunk-accuracy").textContent();
    check((await page.getByTestId("chunk-next").count()) === 0, `after a rank-D take (${acc}): no Next`);
    check((await page.getByTestId("chunk-again").textContent()) === "Learn bars 1–4 again", "\"Learn bars 1–4 again\" shows");
    check((await focused(page)) === "Retry", `Retry keeps focus (${await focused(page)})`);
  }
  await page.screenshot({ path: join(out, `results-fail-${size}.png`) });

  // 4. The last chunk leads to the whole song.
  if (first) {
    await botTake(page, `/play?song=twinkle&from=9&to=12&tempo=70&passes=1&practice=1&bot=perfect&${off}`);
    const whole = page.getByTestId("chunk-next");
    check((await whole.textContent()) === "Play the whole song", `after the last chunk: "${await whole.textContent()}"`);
    check((await focused(page)) === "chunk-next", "it has focus");
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname === "/play" && !u.searchParams.has("from"), { timeout: 30_000 });
    check(params(page) === "song=twinkle", `Enter opens /play?${params(page)}`);
  }
  await page.close();
}
await browser.close();
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-chunks: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-chunks: pass (evidence: ${out})`);
process.exit(0);
