// Note material (spec: note-material, #1174): one deep pass on the falling notes. Each pill is a lit glass rod: an
// emissive core in its hand's color, a specular top edge one device pixel tall, a soft falloff into its trailing end,
// and a rim that stays 3:1 against the field however far it is. Its last 300 ms ignite it white-hot; long notes carry a
// faint energy texture locked to the beat, and a held one burns a line at the hit line. Bloom is a cached sprite near
// the line, never a per-note shadowBlur. The highway draws each note with one drawNote call (core/highway.ts).
import {
  bodyColor,
  bucket,
  chordGroups,
  css,
  edgePx,
  emission,
  hairlineAlpha,
  materialSettings as m,
  mix,
  rgb,
  rimColor,
  rimFloor,
  texturePhase,
  type lod,
} from "./material";

export * from "./material";

export interface Projection {
  project(x: number, y: number): number; // x at the judgment line -> x at height y (the highway's perspective)
}

// A rounded quad from x-range [x0, x1] (at the line) between yTop and yBottom, through the perspective: the highway's
// own bar path, so a pill's material lines up with its hit area.
export function notePath(ctx: CanvasRenderingContext2D, L: Projection, x0: number, x1: number, yTop: number, yBottom: number, radius: number) {
  const r = Math.min(radius, (x1 - x0) / 3, (yBottom - yTop) / 2);
  const tl = L.project(x0, yTop), tr = L.project(x1, yTop);
  const bl = L.project(x0, yBottom), br = L.project(x1, yBottom);
  ctx.beginPath();
  ctx.moveTo((tl + tr) / 2, yTop);
  ctx.arcTo(tr, yTop, br, yBottom, r);
  ctx.arcTo(br, yBottom, bl, yBottom, r);
  ctx.arcTo(bl, yBottom, tl, yTop, r);
  ctx.arcTo(tl, yTop, tr, yTop, r);
  ctx.closePath();
}

type Surface = { width: number; height: number; getContext(id: "2d"): unknown };
const PAD = 14; // the sprite's blur room on each side

// Pre-blurred glow sprites, one per hand color and size bucket, built once. builds counts them for the tests.
export class SpriteCache {
  builds = 0;
  private sprites = new Map<string, Surface>();
  constructor(private make: (w: number, h: number) => Surface | null = defaultSurface) {}
  get(color: string, w: number, h: number): Surface | null {
    const [bw, bh] = bucket(w, h);
    const key = `${color} ${bw} ${bh}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const made = this.make(bw + PAD * 2, bh + PAD * 2);
    if (!made) return null;
    s = made;
    const g = s.getContext("2d") as CanvasRenderingContext2D | null;
    if (g) {
      g.shadowColor = color;
      g.shadowBlur = PAD * 0.75; // the one blur, at build time
      g.fillStyle = color;
      g.fillRect(PAD, PAD, bw, bh);
    }
    this.builds++;
    this.sprites.set(key, s);
    return s;
  }
}

function defaultSurface(w: number, h: number): Surface | null {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h) as unknown as Surface;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export interface Pill {
  x: number; // at the judgment line
  width: number;
  radius: number;
}

export interface NoteState {
  top: number; // the trailing end's y
  bottom: number; // the leading end's y (the hit line, while held)
  hand: string; // the hand's color, read at draw time so it follows hand-palette
  isBlack: boolean;
  brightness: number; // note-pills' approach brightness, 0.35 → 1
  msToHit: number;
  held: boolean;
  miss: boolean;
  missColor: string;
  long: boolean; // long enough to carry the texture
  beatMs: number;
  pxPerMs: number;
  headPx: number; // the white-hot head's height
  glowMs: number; // bloom starts this far out (key-polish)
  heldGlow: number; // bloom on a held note, of the full
  field: string; // what the note is drawn on, for the rim's contrast floor
  pixelRatio: number; // the canvas's backing ratio, for the one-device-pixel edge
  detail: ReturnType<typeof lod>;
  reduced: boolean;
}

const WHITE = "255,255,255";

export function drawNote(ctx: CanvasRenderingContext2D, L: Projection & { judgmentLineY: number }, pill: Pill, s: NoteState, nowMs: number, cache: SpriteCache): void {
  const x0 = pill.x;
  const x1 = pill.x + pill.width;
  const { top, bottom } = s;
  const h = bottom - top;
  const path = () => notePath(ctx, L, x0, x1, top, bottom, pill.radius);

  if (s.miss) {
    ctx.fillStyle = s.missColor;
    path();
    ctx.fill();
    return;
  }

  // Bloom under the body: the leading end's sprite, from glowMs out, at heldGlow while held. Dense passages skip it.
  const near = s.held ? s.heldGlow : 1 - Math.min(1, Math.max(0, s.msToHit) / s.glowMs);
  if (near > 0 && s.detail.bloom) {
    const sh = Math.min(h, 64);
    const sprite = cache.get(s.hand, pill.width, sh);
    if (sprite) {
      const lx = L.project(x0, bottom);
      const w = L.project(x1, bottom) - lx;
      const [bw, bh] = bucket(pill.width, sh);
      const kx = w / bw;
      const ky = sh / bh;
      ctx.globalAlpha = near * 0.9;
      ctx.drawImage(sprite as CanvasImageSource, lx - PAD * kx, bottom - sh - PAD * ky, (bw + PAD * 2) * kx, (bh + PAD * 2) * ky);
      ctx.globalAlpha = 1;
    }
  }

  // The body: black underlay, then the hand color at the approach brightness, so the color stays exact and nothing
  // behind shows through a far note.
  const b = s.held ? 1 : s.brightness;
  if (b < 1) {
    ctx.fillStyle = "#000";
    path();
    ctx.fill();
  }
  const body = bodyColor(s.hand, s.isBlack);
  ctx.globalAlpha = b;
  ctx.fillStyle = css(body);
  path();
  ctx.fill();

  ctx.save();
  ctx.clip();
  // The emissive core: the center of the rod lighter, its edges the pure hand color.
  const cx0 = L.project(x0, bottom);
  const cx1 = L.project(x1, bottom);
  const left = Math.min(cx0, L.project(x0, top)) - 1; // the clip's bounding box, for the full-width layers
  const span = Math.max(cx1, L.project(x1, top)) + 1 - left;
  const core = ctx.createLinearGradient(cx0, 0, cx1, 0);
  core.addColorStop(0.5 - m.coreShare / 2, `rgba(${WHITE},0)`);
  core.addColorStop(0.5, `rgba(${WHITE},${m.coreWhite})`);
  core.addColorStop(0.5 + m.coreShare / 2, `rgba(${WHITE},0)`);
  ctx.fillStyle = core;
  ctx.fillRect(left, top, span, h);

  // The soft falloff into the trailing end.
  const fall = Math.min(m.falloffPx, h / 2);
  const fade = ctx.createLinearGradient(0, top, 0, top + fall);
  fade.addColorStop(0, `rgba(0,0,0,${m.falloffAlpha})`);
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(left, top, span, fall);

  // A long note's energy: faint bands, one spacing per beat, moving toward the line. Off under reduced motion and on
  // dense passages.
  if (s.long && s.detail.texture && !s.reduced) {
    const spacing = (s.beatMs / m.textureBands) * s.pxPerMs;
    if (spacing >= 4) {
      ctx.fillStyle = `rgba(${WHITE},${m.textureAlpha})`;
      for (let y = bottom - spacing + texturePhase(nowMs, s.beatMs) * spacing; y > top - spacing; y -= spacing) ctx.fillRect(left, y, span, spacing / 2);
    }
  }

  // The white-hot head, soft rather than a hard line.
  const head = ctx.createLinearGradient(0, bottom - s.headPx, 0, bottom);
  head.addColorStop(0, `rgba(${WHITE},0)`);
  head.addColorStop(1, `rgba(${WHITE},1)`);
  ctx.fillStyle = head;
  ctx.fillRect(left, bottom - s.headPx, span, s.headPx);

  // Ignition: white heat over the whole rod in its last emissionMs.
  const e = s.held ? 0 : emission(s.msToHit, s.reduced);
  if (e > 0) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${WHITE},${m.emissionWhite * e})`;
    ctx.fillRect(left, top, span, h);
  }

  // The rim, its inner half kept by the clip, never under 3:1 against the field; then the specular top edge.
  ctx.globalAlpha = Math.max(b, rimFloor(s.hand, s.field));
  ctx.strokeStyle = css(rimColor(s.hand));
  ctx.lineWidth = 2;
  path();
  ctx.stroke();
  ctx.globalAlpha = b;
  ctx.fillStyle = `rgba(${WHITE},${m.edgeAlpha})`;
  ctx.fillRect(left, top, span, edgePx(s.pixelRatio));
  ctx.restore();
  ctx.globalAlpha = 1;

  // Held: a burn line at the hit line, white with the hand's color under it, handing off to the key's own light.
  if (s.held) {
    ctx.fillStyle = css(mix(rgb(s.hand), [255, 255, 255], 0.7));
    ctx.fillRect(L.project(x0, bottom), bottom - m.burnPx, L.project(x1, bottom) - L.project(x0, bottom), m.burnPx);
  }
}

export interface LeadingEnd {
  startMs: number;
  x0: number; // pill x-range at the line
  x1: number;
  y: number; // the leading end
  body: [number, number, number]; // its body color at its approach brightness
}

// A faint hairline across the leading ends of each chord, never brighter than its dimmest note (bar-lines' calm rule).
export function drawChordHairlines(ctx: CanvasRenderingContext2D, L: Projection, ends: LeadingEnd[], field: string, pixelRatio: number): void {
  for (const g of chordGroups(ends.map((e) => e.startMs))) {
    const notes = g.map((i) => ends[i]);
    const dimmest = notes.reduce((a, n) => (n.body.reduce((p, v) => p + v, 0) < a.body.reduce((p, v) => p + v, 0) ? n : a));
    const a = hairlineAlpha(dimmest.body, field);
    if (a <= 0) continue;
    const y = notes[0].y;
    const from = Math.min(...notes.map((n) => L.project(n.x0, y)));
    const to = Math.max(...notes.map((n) => L.project(n.x1, y)));
    ctx.fillStyle = `rgba(${WHITE},${a})`;
    ctx.fillRect(from, y - edgePx(pixelRatio), to - from, edgePx(pixelRatio));
  }
}
