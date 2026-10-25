// Headless proof of the score card (spec: score-card, Validation). Its own `next dev`. For three takes at 1920×1080
// (twinkle bot=perfect, twinkle bot=rank-c, fur-elise bot=sloppy): results, Save card, then
// - one download: a 1920×1080 PNG named piano-arcade-<song>-<YYYY-MM-DD>-<rank>.png, the rank the results show;
// - no request after the click (nothing leaves the browser);
// - the PNG in an <img>: its pixel in the rank's box is gold within ΔE76 10.
// Keeps the three PNGs. Usage: node web/src/game/score-card/verify-card.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-card.mjs --out <dir>");
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
say(`verify-card: starting next dev on ${port}`);
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

// ΔE76 between two sRGB colors, through CIE Lab (D65).
function lab([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [r, g, b].map(lin);
  const xyz = [(R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, R * 0.2126 + G * 0.7152 + B * 0.0722, (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883];
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));
const GOLD = [0xff, 0xe2, 0x7a]; // ui-tokens' gold

const TAKES = [
  { song: "twinkle", bot: "perfect" },
  { song: "twinkle", bot: "rank-c" },
  { song: "fur-elise", bot: "sloppy" },
];

const browser = await chromium.launch();
const errors = [];
for (const t of TAKES) {
  const tag = `${t.song} bot=${t.bot}`;
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  try {
    await page.goto(`${base}/play?song=${t.song}&beat=off&bot=${t.bot}`);
    await page.getByRole("button", { name: "Start" }).click({ timeout: 90_000 });
    await page.getByTestId("results").waitFor({ timeout: 180_000 });
    await page.waitForTimeout(2500);
    const rank = (await page.getByTestId("rank").innerText()).trim();
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByTestId("save-card").click()]);
    const name = download.suggestedFilename();
    const file = join(out, name);
    await download.saveAs(file);
    await page.waitForTimeout(500);
    const pattern = new RegExp(`^piano-arcade-${t.song}-\\d{4}-\\d{2}-\\d{2}-${rank}\\.png$`);
    check(pattern.test(name), `${tag}: one download, ${name} (rank ${rank} on the results)`);
    // The download is a blob: URL, the page's own; anything else left the browser.
    const left = requests.filter((u) => !u.startsWith("blob:") && !u.startsWith("data:"));
    check(left.length === 0, `${tag}: no request after the click${left.length ? ` (${left.join(", ")})` : ""}`);

    // The PNG itself: its size, and the rank's pixel. The rank is drawn at x 1000, baseline 720, 420 px (card.ts).
    const img = await ctx.newPage();
    const bytes = readFileSync(file).toString("base64");
    const probe = await img.evaluate(async (b64) => {
      const im = new Image();
      im.src = `data:image/png;base64,${b64}`;
      await im.decode();
      const c = document.createElement("canvas");
      c.width = im.naturalWidth;
      c.height = im.naturalHeight;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0);
      // The rank's box: the most gold-like pixel in it, so the glyph's shape doesn't matter.
      const d = g.getImageData(990, 470, 300, 250).data;
      let best = null;
      for (let i = 0; i < d.length; i += 4) {
        const px = [d[i], d[i + 1], d[i + 2]];
        const dist = Math.abs(px[0] - 255) + Math.abs(px[1] - 226) + Math.abs(px[2] - 122);
        if (!best || dist < best.dist) best = { px, dist };
      }
      return { w: im.naturalWidth, h: im.naturalHeight, px: best.px };
    }, bytes);
    check(probe.w === 1920 && probe.h === 1080, `${tag}: the PNG is ${probe.w}×${probe.h}`);
    const dE = deltaE(probe.px, GOLD);
    check(dE <= 10, `${tag}: the rank's pixel rgb(${probe.px.join(", ")}) is gold, ΔE76 ${dE.toFixed(1)}`);
    await img.close();
  } catch (e) {
    check(false, `${tag}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();

check(errors.length === 0, errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
if (failures.length) {
  say(`verify-card: ${failures.length} failed`);
  process.exit(1);
}
say(`verify-card: pass (evidence: ${out})`);
process.exit(0);
