// Browser proof of hero-replay (spec: hero-replay, Validation): next dev, headless Chromium at 1920×1080, the piano
// sim (midi=sim) as the Portable Grand. An init script creates /play's test hook, so the page reports its results
// and chart clock (as it does for ?input=test) without changing how it plays.
// 1. /play?song=twinkle&bot=rank-c&midi=sim -> results; Download MIDI; keep the bytes and the results.
// 2. /takes/verify.mid routed to those bytes (nothing written to web/public/), then bot=take&take=verify.mid with
//    audible=1: the same counts, accuracy, max combo and every note's judgment; the sim's piano got one note-on per
//    press at the file's velocities.
// 3. Step 2 again: the same judgments, and a screenshot at the same chart time in each run.
// 4. take=../x.mid and another song's take each show a toast and play normally.
// Usage: node web/src/game/hero-replay/verify-hero.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-hero.mjs --out <dir>");
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
say(`verify-hero: next dev on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
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

const browser = await chromium.launch({ headless: true });
const errors = [];
let takeBytes = null;

// One take on a fresh page: Start, the results, and what the page and the sim's piano saw.
async function take(path, { download = false, shotAtMs = null, shot = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__pianoArcade = { ready: false, chart: null, press: () => {}, results: null };
  });
  if (takeBytes) await context.route("**/takes/*.mid", (r) => r.fulfill({ status: 200, contentType: "audio/midi", body: takeBytes }));
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      break;
    } catch (e) {
      if (i > 90) throw e;
      await page.waitForTimeout(1000); // the server is still starting
    }
  }
  const start = page.getByRole("button", { name: "Start", exact: true });
  await start.waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1000); // the bot device reads its take before Start
  const toasts = await page.getByTestId("toast").allTextContents();
  await start.click();
  if (shotAtMs !== null) {
    await page.waitForFunction((t) => (window.__pianoArcade.now?.() ?? -Infinity) >= t, shotAtMs, { timeout: 60_000, polling: 5 });
    await page.screenshot({ path: join(out, shot) });
  }
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  const results = await page.evaluate(() => window.__pianoArcade.results);
  const sent = await page.evaluate(async () => {
    try {
      const access = await navigator.requestMIDIAccess();
      return [...access.outputs.values()].flatMap((o) => (o.sent ?? []).map((s) => [...s.data]));
    } catch {
      return [];
    }
  });
  let bytes = null;
  if (download) {
    const [d] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-midi").click()]);
    bytes = readFileSync(await d.path());
  }
  await context.close();
  return { results, sent, bytes, toasts };
}

const summary = (r) => ({ counts: r.counts, accuracy: r.accuracy, maxCombo: r.maxCombo });
const judged = (r) => r.judgments.map((j) => `${j.noteId}:${j.judgment}`).join(",");

// 1
const live = await take("/play?song=twinkle&bot=rank-c&midi=sim", { download: true });
check(live.results && live.bytes?.length > 0, `1: rank-c take -> results (${live.results?.counts.PERFECT} PERFECT, ${live.results?.counts.MISS} MISS) and a ${live.bytes?.length}-byte .mid`);
takeBytes = live.bytes;
const pressVelocities = [];
{
  // The file's presses, read the plain way: every 0x90 with a velocity.
  const b = live.bytes;
  let i = 22;
  const end = b.length;
  const num = () => {
    let n = 0;
    while (b[i] & 0x80) n = (n << 7) | (b[i++] & 0x7f);
    return (n << 7) | b[i++];
  };
  while (i < end) {
    num();
    const st = b[i++];
    if (st === 0xff) {
      i++;
      i += num();
    } else {
      if ((st & 0xf0) === 0x90 && b[i + 1] > 0) pressVelocities.push(b[i + 1]);
      i += 2;
    }
  }
}

// 2 and 3
const replays = [];
for (const n of [1, 2]) {
  const r = await take("/play?song=twinkle&bot=take&take=verify.mid&midi=sim&audible=1", { shotAtMs: 8000, shot: `replay-${n}-8s.png` });
  replays.push(r);
  const same = r.results && JSON.stringify(summary(r.results)) === JSON.stringify(summary(live.results));
  check(same, `${n + 1}: replay ${n}'s counts, accuracy and max combo equal the live take's (${JSON.stringify(r.results && summary(r.results))})`);
  check(r.results && judged(r.results) === judged(live.results), `${n + 1}: replay ${n}: every note's judgment equals the live take's`);
  const ons = r.sent.filter((m) => m[0] === 0x90 && m[2] > 0).map((m) => m[2]);
  check(JSON.stringify(ons) === JSON.stringify(pressVelocities), `${n + 1}: replay ${n}: the piano got ${ons.length} note-ons for ${pressVelocities.length} presses, at the file's velocities`);
}
check(replays[0].results && replays[1].results && judged(replays[0].results) === judged(replays[1].results), "3: both replays judge every note the same");

// 4
const bad = await take("/play?song=twinkle&bot=take&take=../x.mid");
check(bad.toasts.some((t) => /isn't a file name/.test(t)), `4: take=../x.mid -> a toast (${bad.toasts.join(" | ")})`);
check(bad.results !== null, "4: take=../x.mid -> the take plays normally to its results");
const other = await take("/play?song=ode-to-joy&bot=take&take=verify.mid");
check(other.toasts.some((t) => /not "/.test(t)), `4: another song's take -> a toast (${other.toasts.join(" | ")})`);
check(other.results !== null, "4: another song's take -> the take plays normally to its results");

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-hero.json"), JSON.stringify({ failures, live: summary(live.results) }, null, 2));
await browser.close();
say(`verify-hero: screenshots in ${out}`);
say(failures.length ? `verify-hero: ${failures.length} failed` : "verify-hero: pass");
process.exit(failures.length ? 1 : 0);
