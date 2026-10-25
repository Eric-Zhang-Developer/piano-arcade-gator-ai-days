// Headless proof of notice-toast, at 1280×720 and 1920×1080:
// 1. /play?bot=nobody: one unknown-bot toast at the top right, gone by 4 s, and no scenes-notice.
// 2. /sim: Watch the bot, then Unplug -> the disconnected toast in the game; Replug -> the connected toast.
// 3. Reduced motion: the toast's box doesn't move between appearing and leaving.
// 4. Mid-song with a toast up: it's below the HUD band and inside the top half, clear of the highway's lower half.
// The toast must be gone by 4 s + 100 ms. The one lateness excused is a long task the page records running past the leave
// (3.8 s): on a starved page the toast goes in the first frame after it, and no frame can come sooner (#584). Each such
// stall is printed. CPU=6 throttles the page's CPU 6x (Chrome's own emulation, no load on the machine) to prove that.
// Usage: [CPU=6] node web/src/game/notice-toast/verify-toast.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-toast.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const HUD_MAX = 84; // hudLayout's band height cap
const TOAST_MS = 4000;
const LEAVE_MS = 200; // toastSettings.leaveMs: both motions leave at TOAST_MS - LEAVE_MS
const CPU = Number(process.env.CPU ?? 1);

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-toast: starting next dev on ${port}`);
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
  if (await fetch(`${base}/play`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 500));
}

// In the page: when the first toast is put in the DOM and when the last one leaves it, timed exactly by a
// MutationObserver (an animation-frame poll is up to a frame late, 30–50 ms on a CI runner: #432), and every frame's
// box and text while it shows, and the long tasks (over 50 ms) that ran past the leave.
const TRACK = `new Promise((done) => {
  const samples = [];
  const longs = [];
  new PerformanceObserver((l) => longs.push(...l.getEntries().map((e) => [e.startTime, e.duration]))).observe({ type: "longtask" });
  let seenAt = null;
  let goneAt = null;
  const toastIn = (n) => n.nodeType === 1 && (n.matches('[data-testid="toast"]') || n.querySelector('[data-testid="toast"]'));
  const watch = new MutationObserver((records) => {
    const now = performance.now();
    if (seenAt === null && records.some((r) => [...r.addedNodes].some(toastIn))) seenAt = now;
    if (seenAt !== null && !document.querySelector('[data-testid="toast"]')) {
      goneAt = now;
      watch.disconnect();
    }
  });
  watch.observe(document, { childList: true, subtree: true });
  const tick = () => {
    if (goneAt !== null) {
      const stalls = longs.filter(([t, d]) => t + d > seenAt + ${TOAST_MS - LEAVE_MS} && t < goneAt).map(([t, d]) => ({ at: Math.round(t - seenAt), ms: Math.round(d) }));
      return done({ samples, goneMs: goneAt - seenAt, stalls });
    }
    const t = document.querySelector('[data-testid="toast"]');
    if (t) {
      const r = t.getBoundingClientRect();
      samples.push({ ms: performance.now() - seenAt, left: r.left, right: r.right, top: r.top, bottom: r.bottom, text: t.textContent,
        font: parseFloat(getComputedStyle(t).fontSize), count: document.querySelectorAll('[data-testid="toast"]').length });
    }
    requestAnimationFrame(tick);
  };
  tick();
})`;

const browser = await chromium.launch({ headless: true });
const fail = [];
const results = {};
try {
  for (const [w, h, minFont] of [
    [1280, 720, 16],
    [1920, 1080, 24],
  ]) {
    for (const reduced of [false, true]) {
      const tag = `${w}x${h}${reduced ? "-reduced" : ""}`;
      const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? "reduce" : "no-preference" });
      const page = await context.newPage();
      if (CPU > 1) await (await context.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: CPU });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(`window.__toastTrack = ${TRACK};`);
      await page.goto(`${base}/play?song=fur-elise&bot=nobody&input=test`);
      const tracking = page.evaluate(() => window.__toastTrack);
      // 4: a shot with the toast up, 1.5 s in, over the count-in
      await page.locator('[data-testid="toast"]').waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      if (!reduced) await page.screenshot({ path: join(out, `${tag}-toast.png`) });
      const track = await tracking;
      const s = track.samples;
      const settled = s.filter((x) => x.ms > 300 && x.ms < TOAST_MS - 300);
      const box = settled.at(-1) ?? s.at(-1);
      const scenes = await page.locator('[data-testid="scenes-notice"]').count();
      const stall = Math.max(0, ...track.stalls.map((x) => x.ms));
      results[tag] = { goneMs: track.goneMs, stalls: track.stalls, first: s[0], box, frames: s.length, errors };
      await context.close();

      const where = `${tag}:`;
      if (!/Unknown bot "nobody"/.test(box.text)) fail.push(`${where} toast says ${JSON.stringify(box.text)}`);
      if (Math.max(...s.map((x) => x.count)) !== 1) fail.push(`${where} more than one toast`);
      if (scenes) fail.push(`${where} the old scenes-notice is still drawn`);
      if (track.goneMs > TOAST_MS + 100 + stall)
        fail.push(`${where} the toast stayed ${track.goneMs.toFixed(0)} ms (bound ${TOAST_MS + 100} + ${stall} ms of long task)`);
      if (Math.abs(box.right - (w - 16)) > 1) fail.push(`${where} right edge at ${box.right}, want ${w - 16}`);
      if (box.top < HUD_MAX) fail.push(`${where} top at ${box.top}, under the HUD band (${HUD_MAX})`);
      if (box.bottom > h / 2) fail.push(`${where} bottom at ${box.bottom}, below the top half (${h / 2})`);
      if (box.font < minFont) fail.push(`${where} text ${box.font} px, want at least ${minFont}`);
      if (reduced) {
        const moved = s.some((x) => x.left !== s[0].left || x.top !== s[0].top);
        if (moved) fail.push(`${where} the box moved under reduced motion`);
      } else if (!(s[0].left > box.left)) fail.push(`${where} no slide-in (first frame at ${s[0].left}, settled at ${box.left})`);
      if (errors.length) fail.push(`${where} page errors: ${errors.join("; ")}`);
      say(`verify-toast: ${tag} one toast at ${box.left.toFixed(0)}–${box.right.toFixed(0)} × ${box.top.toFixed(0)}–${box.bottom.toFixed(0)}, ${box.font} px, gone at ${track.goneMs.toFixed(0)} ms${stall ? ` after a ${stall} ms long task` : ""}${reduced ? ", still the whole time" : ""}`);
    }
  }

  // 2. Unplug and replug on /sim.
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${base}/sim`);
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent === "Watch the bot" && !b.disabled), null, { timeout: 60_000 });
  await page.getByRole("button", { name: "Watch the bot" }).click();
  const game = page.frameLocator('iframe[title="game"]');
  await page.waitForTimeout(5000); // into the song
  await page.getByRole("button", { name: "Unplug" }).click();
  const unplugged = game.locator('[data-testid="toast"]', { hasText: "Piano disconnected" });
  await unplugged.waitFor({ timeout: 3000 }).catch(() => fail.push("/sim: no disconnected toast after Unplug"));
  await page.waitForTimeout(400); // past the 200 ms fade-in
  await page.screenshot({ path: join(out, "sim-unplugged.png") });
  await page.getByRole("button", { name: "Replug" }).click();
  const replugged = game.locator('[data-testid="toast"]', { hasText: "Piano connected" });
  await replugged.waitFor({ timeout: 3000 }).catch(() => fail.push("/sim: no connected toast after Replug"));
  await page.waitForTimeout(400); // past the 200 ms fade-in
  await page.screenshot({ path: join(out, "sim-replugged.png") });
  results.sim = { toasts: await game.locator('[data-testid="toast"]').allTextContents() };
  say(`verify-toast: /sim toasts ${JSON.stringify(results.sim.toasts)}`);
  await context.close();
  writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
if (fail.length) {
  say(`verify-toast: FAIL\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
say(`verify-toast: pass (evidence: ${out})`);
process.exit(0);
