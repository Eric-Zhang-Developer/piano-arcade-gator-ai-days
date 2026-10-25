// The highlight-reel spike's reel check, shared: verify-highlight.mjs (the bars that must keep passing, run by CI)
// and spikes/highlight-reel/measure.mjs (every bar, the spike's yes/no) both run it. Named so CI doesn't pick it up
// on its own. Three takes rendered to WebM; bars as numbered in the spec's Validation 2:
// 1 length 15.0 ± 0.1 s, 2 900 ± 6 video packets at a 16.7 ± 0.5 ms median spacing, 3 one audio and one video stream,
// 4 sync (≥ 90% of expected onsets within 50 ms, median ≤ 10 ms), 5 the cold open's middle frame shows the best run
// (PSNR ≥ 30 dB against drawFrame, < 20 dB against black), 6 a second render repeats the sound and every 30th frame,
// 7 no console error. Without ffprobe (CI's runner) bars 1, 2 and 4 use the page's fallback, labeled so, and 3 and 5
// are skipped.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { detectOnsets, matchOnsets } from "./onsets.ts";

const webDir = fileURLToPath(new URL("../../../../", import.meta.url));
const say = (s) => process.stdout.write(`${s}\n`);

// The --out argument, made; exits 2 without one.
export function outDir(script) {
  const i = process.argv.indexOf("--out");
  if (i < 0 || !process.argv[i + 1]) {
    console.error(`usage: ${script} --out <dir>`);
    process.exit(2);
  }
  const out = resolve(process.argv[i + 1]);
  mkdirSync(out, { recursive: true });
  return out;
}
const has = (bin) => {
  try {
    execFileSync(bin, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const FF = has("ffprobe") && has("ffmpeg");
const probe = (file, args) => execFileSync("ffprobe", ["-v", "error", ...args, file], { encoding: "utf8", maxBuffer: 1 << 26 }).trim();
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", ...args], { maxBuffer: 1 << 28 });
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];
const psnr = (a, b) => {
  let se = 0;
  for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
  const mse = se / a.length;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
};

// Renders the spec's three takes and reports the asked bars (the spec's Validation numbering). Returns the failures.
export async function runReelCheck({ out, bars, label }) {
  const port = await new Promise((res, rej) => {
    const s = createServer().once("error", rej);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
  const base = `http://localhost:${port}`;
  say(`${label}: starting next dev on ${port}${FF ? "" : " (skip: ffprobe missing, using the page's fallback)"}`);
  const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], { cwd: webDir, detached: true, stdio: ["ignore", "ignore", "inherit"] });
  process.on("exit", () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // already gone
    }
  });
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

  const failures = [];
  bars = [0, ...bars];
  // Only the asked bars are reported; each says PASS or FAIL.
  const check = (bar, ok, line) => {
    if (!bars.includes(bar)) return;
    say(`  bar ${bar} ${ok ? "PASS" : "FAIL"}: ${line}`);
    if (!ok) failures.push(`bar ${bar}: ${line}`);
  };
  const skip = (bar, what) => bars.includes(bar) && say(`  bar ${bar} skip: ffprobe missing (${what})`);

  const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
  const errors = [];
  const newPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
    return page;
  };

  // Renders the page's reel and saves the WebM; returns the hook's numbers.
  // keys: start it from the keyboard and check where focus goes (lab-pages-a11y, #1143).
  async function render(page, name, keys = false) {
    await page.waitForFunction(() => window.__highlightReel?.state === "ready", null, { timeout: 120_000 });
    const focused = () => page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName);
    if (keys) {
      await page.getByTestId("highlight-render").focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__highlightReel?.state !== "ready", null, { timeout: 10_000 });
      const f = await focused();
      check(0, f === "highlight-render", `${name}: while it records, focus stays on Render (${f})`);
    } else await page.getByTestId("highlight-render").click();
    await page.waitForFunction(() => ["done", "error"].includes(window.__highlightReel?.state), null, { timeout: 120_000 });
    if (keys) {
      const moved = await page.waitForFunction(() => document.activeElement?.getAttribute("data-testid") === "highlight-save", null, { timeout: 5_000 }).then(() => true, () => false);
      check(0, moved, `${name}: when the reel is done, focus moves to Save video (${await focused()})`);
    }
    const hook = await page.evaluate(() => {
      const h = window.__highlightReel;
      return { state: h.state, edl: h.edl, bestRun: h.bestRun, expected: h.expectedOnsetsMs, framesRequested: h.framesRequested, framesLate: h.framesLate, drawMs: h.drawMs, audioHash: h.audioHash, mimeType: h.mimeType, blobBytes: h.blobBytes };
    });
    if (hook.state !== "done") throw new Error(`${name}: the render ended in "${hook.state}"`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("highlight-save").click()]);
    const file = join(out, `${name}.webm`);
    await download.saveAs(file);
    writeFileSync(join(out, `${name}.json`), JSON.stringify(hook, null, 2));
    return { ...hook, file };
  }

  async function measure(page, name, r) {
    say(`${label}: ${name}: ${r.mimeType}, ${(r.blobBytes / 1e6).toFixed(1)} MB, framesRequested ${r.framesRequested}, framesLate ${r.framesLate}, drawFrame median ${r.drawMs.median.toFixed(1)} ms, p95 ${r.drawMs.p95.toFixed(1)} ms`);
    const fb = FF ? null : await page.evaluate((full) => window.__highlightReel.fallback(full), bars.includes(2) || bars.includes(4));
    // 1 length
    let dur;
    if (FF) {
      const d = probe(r.file, ["-show_entries", "format=duration", "-of", "csv=p=0"]);
      if (d && d !== "N/A") dur = Number(d);
      else {
        const ends = probe(r.file, ["-show_entries", "packet=pts_time,duration_time", "-of", "csv=p=0"]).split("\n").map((l) => l.split(",").map(Number)).map(([p, d]) => p + (d || 0));
        dur = Math.max(...ends.filter(Number.isFinite));
      }
    } else dur = fb.durationS;
    check(1, Math.abs(dur - 15) <= 0.1, `${name}: length ${dur.toFixed(3)} s${FF ? "" : " (fallback)"}, want 15.0 ± 0.1`);
    // 2 60 fps
    if (FF) {
      const pts = probe(r.file, ["-select_streams", "v:0", "-show_entries", "packet=pts_time", "-of", "csv=p=0"]).split("\n").map((l) => Number(l.split(",")[0])).filter(Number.isFinite).sort((a, b) => a - b);
      const gap = median(pts.slice(1).map((t, i) => (t - pts[i]) * 1000));
      check(2, Math.abs(pts.length - 900) <= 6 && Math.abs(gap - 16.7) <= 0.5, `${name}: ${pts.length} video packets, median spacing ${gap.toFixed(2)} ms, want 900 ± 6 at 16.7 ± 0.5`);
    } else check(2, Math.abs(fb.frames - 900) <= 6, `${name}: ${fb.frames} frames over a 1× playback (fallback), want 900 ± 6`);
    // 3 tracks
    if (FF) {
      const types = probe(r.file, ["-show_entries", "stream=codec_type,codec_name", "-of", "csv=p=0"]).split("\n");
      const v = types.filter((t) => t.includes("video"));
      const a = types.filter((t) => t.includes("audio"));
      check(3, v.length === 1 && a.length === 1, `${name}: streams ${types.join(" | ")}, want one video and one audio`);
    } else skip(3, "tracks");
    if (!bars.some((b) => b === 4 || b === 5)) return;
    // 4 sync
    let detected;
    if (FF) {
      const raw = ff(["-i", r.file, "-f", "f32le", "-ac", "1", "-ar", "48000", "-"]);
      // decoded samples start at the audio stream's start; put them on the file's timeline, where video frame 0 is
      const starts = Object.fromEntries(probe(r.file, ["-show_entries", "stream=codec_type,start_time", "-of", "csv=p=0"]).split("\n").map((l) => l.split(",")).map(([t, s]) => [t, Number(s) || 0]));
      const shift = ((starts.audio ?? 0) - (starts.video ?? 0)) * 1000;
      detected = detectOnsets(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), 48000).map((t) => t + shift);
      say(`  audio starts ${shift.toFixed(1)} ms after video in the file`);
    } else detected = fb.onsetsMs;
    const m = matchOnsets(r.expected, detected);
    check(4, m.matched >= 0.9 * m.expected && m.median <= 10, `${name}: sync ${m.matched}/${m.expected} expected onsets matched within 50 ms, median ${m.median?.toFixed(1)} ms, p90 ${m.p90?.toFixed(1)} ms${FF ? "" : " (fallback)"}, want ≥ 90% and median ≤ 10`);
    // 5 the slow motion shows the best run
    if (FF) {
      const slow = r.edl.segments[0];
      const n = slow.fromFrame + Math.floor(slow.frames / 2);
      const t = await page.evaluate((n) => window.__highlightReel.takeTimeAt(n), n);
      const inRun = t >= r.bestRun.fromMs && t <= r.bestRun.toMs;
      const got = ff(["-ss", (n / 60).toFixed(4), "-i", r.file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
      const png = join(out, `${name}-frame${n}.png`);
      writeFileSync(png, Buffer.from(await page.evaluate((n) => window.__highlightReel.framePng(n), n), "base64"));
      const want = ff(["-i", png, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1920x1080", "-i", "-", join(out, `${name}-encoded${n}.png`)], { input: got });
      const p = psnr(got, want);
      const black = psnr(got, new Uint8Array(got.length));
      check(5, inRun && p >= 30 && black < 20, `${name}: frame ${n} at take time ${t.toFixed(0)} ms ${inRun ? "inside" : "OUTSIDE"} the best run (${r.bestRun.fromMs.toFixed(0)}–${r.bestRun.toMs.toFixed(0)}), PSNR ${p.toFixed(1)} dB against drawFrame, ${black.toFixed(1)} dB against black`);
    } else skip(5, "the slow-motion frame");
  }

  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(`${base}/highlight`)).ok) break;
      } catch {
        // not up yet
      }
      if (i > 240) throw new Error("server not ready after 120 s");
      await new Promise((r) => setTimeout(r, 500));
    }
    const takes = [
      ["twinkle-rank-b", "/highlight?take=bot:rank-b&song=twinkle"],
      ["minuet-g-sloppy", "/highlight?take=bot:sloppy&song=minuet-g"],
    ];
    let first = null;
    for (const [name, url] of takes) {
      const page = await newPage();
      await page.goto(base + url);
      const r = await render(page, name);
      await measure(page, name, r);
      if (!first) {
        // the design pass's four reel frames (cold open, the 0.5× hold, the finish, the title card), at 1920×1080
        const [slow, finish, title] = r.edl.segments;
        for (const [label, n] of [["cold-open", slow.fromFrame + 20], ["hold", slow.fromFrame + Math.floor(slow.frames / 2)], ["finish", finish.fromFrame + 60], ["title", title.fromFrame + 45]])
          writeFileSync(join(out, `reel-${label}.png`), Buffer.from(await page.evaluate((n) => window.__highlightReel.framePng(n), n), "base64"));
        const hashes = await page.evaluate(() => Array.from({ length: 30 }, (_, k) => window.__highlightReel.frameHash(k * 30)));
        first = { url, audioHash: r.audioHash, hashes };
      }
      await page.close();
    }
    // the take=last path: a bot take on /play with the flag, to the results, then its link
    {
      const page = await newPage();
      await page.goto(`${base}/play?song=twinkle&bot=rank-c&x=highlight-reel`);
      await page.getByRole("button", { name: "Start" }).click({ timeout: 60_000 }).catch(() => {});
      await page.getByTestId("highlight-reel-link").click({ timeout: 120_000 });
      await page.waitForURL(/\/highlight\?take=last/);
      const r = await render(page, "twinkle-rank-c-last");
      check(0, !(await page.getByTestId("highlight-note").count()), "take=last: the saved take, not the fallback");
      await measure(page, "twinkle-rank-c-last", r);
      await page.close();
    }
    // 6 repeatable: a second render of the first take
    {
      const page = await newPage();
      await page.goto(base + first.url);
      const r = await render(page, "twinkle-rank-b-again", true);
      const hashes = await page.evaluate(() => Array.from({ length: 30 }, (_, k) => window.__highlightReel.frameHash(k * 30)));
      const same = hashes.filter((h, k) => h === first.hashes[k]).length;
      check(6, r.audioHash === first.audioHash && same === 30, `repeatable: audioHash ${r.audioHash === first.audioHash ? "same" : "DIFFERENT"}, ${same}/30 frame hashes same`);
      await page.close();
    }
    // 7 console
    check(7, errors.length === 0, `console errors: ${errors.length ? errors.join(" | ") : "none"}`);
  } catch (e) {
    failures.push(e.message);
    say(`${label}: ${e.message}`);
  } finally {
    await browser.close();
  }
  writeFileSync(join(out, "result.json"), JSON.stringify({ bars, failures, errors }, null, 2));
  return failures;

}
