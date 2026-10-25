// Clean-up by code (spec: mascot-spike, method step 3): each pose candidate is one codex image holding its frames
// left to right. Split it at the transparent gaps, scale every frame of the set by one factor, anchor each frame's
// bottom centre to the canvas's bottom centre, then write the frames and a horizontal sprite sheet:
//   out/sets/<sheet>/<pose>-<n>/f1.png … and sprite.png, plus out/manifest.js for pick.html.
// Usage: node spikes/mascot/pack.mjs spikes/mascot/out. Strips are out/strips/<sheet>/<pose>-<n>.png.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { blank, readPng, writePng } from "./png.mjs";

export const CANVAS = 384; // square; the gator stands 90% of it at the tallest frame of its set
export const FRAMES = { idle: 3, pointing: 3, happy: 3, oops: 3, thinking: 3, celebrating: 3 };
const SOLID = 128; // alpha that counts as the figure when looking for gaps and boxes
const GAP = 6; // a gap narrower than this (px) is inside one figure, not between frames

// Column runs that hold figure pixels, merged across narrow gaps; the n heaviest, back in left-to-right order.
export function splitStrip(img, n) {
  const { width, height, px } = img;
  const mass = new Array(width).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (px[(y * width + x) * 4 + 3] >= SOLID) mass[x]++;
  const runs = [];
  for (let x = 0; x < width; x++) {
    if (!mass[x]) continue;
    const last = runs.at(-1);
    if (last && x - last.x1 <= GAP) [last.x1, last.mass] = [x, last.mass + mass[x]];
    else runs.push({ x0: x, x1: x, mass: mass[x] });
  }
  if (runs.length < n) return { frames: null, why: `${runs.length} figures, wanted ${n}` };
  const kept = [...runs].sort((a, b) => b.mass - a.mass).slice(0, n).sort((a, b) => a.x0 - b.x0);
  return { frames: kept.map((r) => crop(img, r.x0, r.x1 + 1)), why: runs.length > n ? `dropped ${runs.length - n} specks` : "" };
}

// The figure's box within columns [x0, x1); stray pixels outside the columns are left behind.
function crop(img, x0, x1) {
  const { width, height, px } = img;
  let top = height, bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = x0; x < x1; x++) if (px[(y * width + x) * 4 + 3] >= SOLID) [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
  const out = blank(x1 - x0, bottom - top + 1);
  for (let y = top; y <= bottom; y++) out.px.set(px.subarray((y * width + x0) * 4, (y * width + x1) * 4), (y - top) * out.width * 4);
  return out;
}

// Box-filter scale by s < 1 into a CANVAS square, bottom-centre anchored. Averages premultiplied colour, so the
// transparent edge doesn't darken the outline.
function place(img, s) {
  const out = blank(CANVAS, CANVAS);
  const w = Math.round(img.width * s), h = Math.round(img.height * s);
  const ox = Math.round((CANVAS - w) / 2), oy = CANVAS - h;
  for (let ty = 0; ty < h; ty++)
    for (let tx = 0; tx < w; tx++) {
      const [sx0, sx1] = [Math.floor(tx / s), Math.min(img.width, Math.ceil((tx + 1) / s))];
      const [sy0, sy1] = [Math.floor(ty / s), Math.min(img.height, Math.ceil((ty + 1) / s))];
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = sy0; y < sy1; y++)
        for (let x = sx0; x < sx1; x++) {
          const o = (y * img.width + x) * 4, al = img.px[o + 3];
          [r, g, b, a, n] = [r + img.px[o] * al, g + img.px[o + 1] * al, b + img.px[o + 2] * al, a + al, n + 1];
        }
      if (!a) continue;
      out.px.set([r / a, g / a, b / a, a / n], ((oy + ty) * CANVAS + ox + tx) * 4);
    }
  return out;
}

function sprite(frames) {
  const out = blank(CANVAS * frames.length, CANVAS);
  frames.forEach((f, i) => {
    for (let y = 0; y < CANVAS; y++) out.px.set(f.px.subarray(y * CANVAS * 4, (y + 1) * CANVAS * 4), (y * out.width + i * CANVAS) * 4);
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? "spikes/mascot/out";
  const manifest = { canvas: CANVAS, sheets: [], sets: [] };
  manifest.sheets = readdirSync(root).filter((f) => /^sheet-\d+\.png$/.test(f)).sort();
  const strips = join(root, "strips");
  for (const sheet of existsSync(strips) ? readdirSync(strips).sort() : []) {
    for (const file of readdirSync(join(strips, sheet)).filter((f) => f.endsWith(".png")).sort()) {
      const name = file.replace(/\.png$/, "");
      const pose = name.replace(/-\d+$/, "");
      const { frames, why } = splitStrip(readPng(join(strips, sheet, file)), FRAMES[pose] ?? 3);
      const entry = { sheet, pose, name, frames: frames?.length ?? 0, note: why };
      manifest.sets.push(entry);
      process.stdout.write(`${sheet}/${name}: ${frames ? `${frames.length} frames` : "not split"}${why ? ` (${why})` : ""}\n`);
      if (!frames) continue;
      const s = 0.9 * CANVAS / Math.max(...frames.map((f) => Math.max(f.height, f.width / 0.95)));
      const placed = frames.map((f) => place(f, s));
      const dir = join(root, "sets", sheet, name);
      mkdirSync(dir, { recursive: true });
      placed.forEach((f, i) => writePng(join(dir, `f${i + 1}.png`), f));
      writePng(join(dir, "sprite.png"), sprite(placed));
    }
  }
  writeFileSync(join(root, "manifest.js"), `window.MASCOT = ${JSON.stringify(manifest, null, 1)};\n`);
}
