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
const SOLID = 128; // alpha that counts as the figure; fainter pixels join the figure they touch, or are dropped

// Each frame is a connected figure. Frames may share columns (a pointing finger reaches over the next frame's tail),
// so the split is by components, not by gaps. The n largest are the frames; a small piece (motion lines) joins the
// frame whose box holds its centre, and the rest are dropped as specks. Edge pixels under SOLID join the figure they
// touch within 2 px, which also leaves behind the faint glow some images have.
export function splitStrip(img, n) {
  const { width, height, px } = img;
  const label = new Int32Array(width * height);
  const comps = [];
  for (let i = 0; i < width * height; i++) {
    if (label[i] || px[i * 4 + 3] < SOLID) continue;
    const c = { id: comps.length + 1, area: 0, x0: width, x1: 0, y0: height, y1: 0 };
    comps.push(c);
    const stack = [i];
    label[i] = c.id;
    while (stack.length) {
      const j = stack.pop(), x = j % width, y = (j - x) / width;
      c.area++;
      [c.x0, c.x1, c.y0, c.y1] = [Math.min(c.x0, x), Math.max(c.x1, x), Math.min(c.y0, y), Math.max(c.y1, y)];
      for (const k of [x > 0 ? j - 1 : -1, x < width - 1 ? j + 1 : -1, y > 0 ? j - width : -1, y < height - 1 ? j + width : -1])
        if (k >= 0 && !label[k] && px[k * 4 + 3] >= SOLID) {
          label[k] = c.id;
          stack.push(k);
        }
    }
  }
  if (comps.length < n) return { frames: null, why: `${comps.length} figures, wanted ${n}` };
  const big = [...comps].sort((a, b) => b.area - a.area).slice(0, n).sort((a, b) => a.x0 - b.x0);
  const owner = new Int32Array(comps.length + 1); // component id -> frame index + 1
  big.forEach((c, f) => (owner[c.id] = f + 1));
  let specks = 0;
  for (const c of comps) {
    if (owner[c.id]) continue;
    const [cx, cy] = [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2];
    const f = big.findIndex((b) => cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1);
    if (f >= 0) owner[c.id] = f + 1;
    else specks++;
  }
  const frames = big.map((b) => blank(b.x1 - b.x0 + 5, b.y1 - b.y0 + 5)); // 2 px margin for the edge pixels
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!px[i * 4 + 3]) continue;
      let f = owner[label[i]];
      for (let dy = -2; !f && dy <= 2; dy++)
        for (let dx = -2; !f && dx <= 2; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) f = owner[label[ny * width + nx]];
        }
      if (!f) continue;
      const b = big[f - 1], out = frames[f - 1];
      const [ox, oy] = [x - b.x0 + 2, y - b.y0 + 2];
      if (ox >= 0 && oy >= 0 && ox < out.width && oy < out.height) out.px.set(px.subarray(i * 4, i * 4 + 4), (oy * out.width + ox) * 4);
    }
  return { frames, why: specks ? `dropped ${specks} specks` : "" };
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
