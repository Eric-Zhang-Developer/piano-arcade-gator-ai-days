// Real Keys (spec: real-keys): each key's outline on the key bed, in bed space (u 0→1 left to right, v 0 at the bed's
// back edge, 1 at its front), then through the homography into the picture. White keys split the bed evenly; black
// keys sit centered on a white-key boundary, BLACK_KEY_WIDTH of a white key wide, as core's highway draws them.
import { isBlack } from "../../core/highway";
import { apply, type H, type Pt } from "./homography";

export const keySettings = {
  blackKeyWidth: 0.6, // × a white key: a copy of core/highway.ts's BLACK_KEY_WIDTH (not exported), pinned by a test
  blackKeyLength: 0.62, // of the bed's depth: specs/decisions/real-keys-geometry.md
};

export type Quad = [Pt, Pt, Pt, Pt]; // back-left, back-right, front-right, front-left

// The keys from lo to hi (MIDI), each pitch's quad in bed space.
export function bedQuads(lo: number, hi: number): Map<number, Quad> {
  const whites: number[] = [];
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites.push(p);
  const w = 1 / whites.length;
  const out = new Map<number, Quad>();
  whites.forEach((p, i) => out.set(p, [[i * w, 0], [(i + 1) * w, 0], [(i + 1) * w, 1], [i * w, 1]]));
  const bw = w * keySettings.blackKeyWidth, bl = keySettings.blackKeyLength;
  for (let p = lo; p <= hi; p++) {
    if (!isBlack(p)) continue;
    const i = whites.indexOf(p - 1); // the white below: -1 when the range starts on a black key
    const x = (i + 1) * w; // the boundary it straddles
    out.set(p, [[x - bw / 2, 0], [x + bw / 2, 0], [x + bw / 2, bl], [x - bw / 2, bl]]);
  }
  return out;
}

export const mapQuad = (m: H, q: Quad): Quad => q.map((p) => apply(m, p)) as Quad;

// The corners the player clicks, in bed space, in the order the page asks for them.
export const BED_CORNERS: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]]; // back-left, back-right, front-right, front-left

// Pixel offsets (y * width + x) of an n×n grid inside a quad, in the picture, made once per calibration so a frame's
// brightness read allocates nothing. The quad is axis-aligned in bed space, as bedQuads makes them.
export function samplePoints(m: H, q: Quad, width: number, height: number, n = 5): Int32Array {
  const out: number[] = [];
  const [[x0, y0], [x1], , [, y3]] = q;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const u = x0 + ((x1 - x0) * (a + 0.5)) / n;
      const v = y0 + ((y3 - y0) * (b + 0.5)) / n;
      const [x, y] = apply(m, [u, v]).map(Math.round);
      if (x >= 0 && y >= 0 && x < width && y < height) out.push(y * width + x);
    }
  return Int32Array.from(out);
}

// Mean luma (Rec. 601, 0–255) of RGBA pixels at the given offsets.
export function meanLuma(rgba: Uint8ClampedArray, at: Int32Array): number {
  if (!at.length) return 0;
  let s = 0;
  for (let i = 0; i < at.length; i++) {
    const k = at[i] * 4;
    s += 0.299 * rgba[k] + 0.587 * rgba[k + 1] + 0.114 * rgba[k + 2];
  }
  return s / at.length;
}
