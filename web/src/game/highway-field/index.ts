// The highway field (spec: highway-field): the dark space the notes fall through. A cool haze at the far end, hairlines
// that fade into it (bar > C octave > E/F seam), a downbeat as a bar line reaches the hit line, and a held key's light
// pooling up its lane. Calm: no field pixel is brighter than the dimmest note, so every layer is drawn as an opaque,
// premultiplied color with "lighten": where layers cross, a pixel takes the brightest one, never their sum.
import type { GameEvent, GamePlugin } from "../../contracts";
import { barLineSettings, drawBarLabels, type BarLine } from "../bar-lines";
import { drawBlackKeyLanes } from "../black-key-lanes";
import type { Layout } from "../core/highway";
import { settings } from "../core/settings";
import { handColorSettings } from "../hand-colors";
import { brightness, pillSettings } from "../note-pills";

export const fieldSettings = {
  octaveAlpha: 0.08, // white at the line; the bar line's is bar-lines' lineAlpha (0.12)
  seamAlpha: 0.04, // the E/F seam, the octave's other half step (B/C is the C line itself)
  downbeatAlpha: 0.18, // a bar line's peak as it reaches the hit line
  downbeatMs: 120,
  horizonHeight: 0.12, // of the highway's height: the haze band at the far end
  horizonLuma: 0.05, // its brightest row, at the top
  horizonColor: "#7cb7ff", // cool, the primary's light side (ui-tokens good)
  feverLuma: 0.08,
  feverColor: "#cfd8ff", // fever-stage's star (stageSettings.star): the stage exports no live tint; decision highway-field-fever
  feverEaseMs: 400, // fever-stage's feverEaseMs, so the haze and the stars turn together
  spillPx: 40, // a held key's light, up its own lane
  spillAlpha: 0.16, // its brightest, at the line, for a white (no-hand) key
  dither: 0.01, // peak to peak, of full scale, on the haze
};

// ---------- pure ----------

// Rec. 709 weights on sRGB values, as bar-lines and fever-stage measure.
export const luma = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
// A color at a, as an opaque color over black: what "lighten" compares.
export const dim = (hex: string, a: number) => `rgb(${rgb(hex).map((c) => Math.round(c * Math.max(0, Math.min(1, a)))).join(",")})`;

// The calm rule's ceiling: the dimmest note is the dimmest hand color at the notes' far brightness.
export function calmLimit(): number {
  const colors = [...Object.values(handColorSettings.colors), settings.noteColor];
  return pillSettings.farBrightness * Math.min(...colors.map(luma));
}

// The notes' own approach brightening: the far brightness at the top, 1 at the line. Linear in y.
export const depth = (y: number, line: number) => brightness(((line - y) / line) * settings.lookaheadMs, settings.lookaheadMs);

export type LineKind = "bar" | "octave" | "seam";
const BASE: Record<LineKind, () => number> = {
  bar: () => barLineSettings.lineAlpha,
  octave: () => fieldSettings.octaveAlpha,
  seam: () => fieldSettings.seamAlpha,
};
export const lineAlpha = (kind: LineKind, y: number, line: number) => BASE[kind]() * depth(y, line);

// 0 … 1 over the downbeatMs before a bar line reaches the line; after it, the line is under the keys. None when still.
export function downbeat(atMs: number, nowMs: number, still: boolean): number {
  const d = atMs - nowMs;
  return still || d < 0 || d > fieldSettings.downbeatMs ? 0 : 1 - d / fieldSettings.downbeatMs;
}
export const barAlpha = (y: number, line: number, k: number) => {
  const rest = lineAlpha("bar", y, line);
  return rest + (fieldSettings.downbeatAlpha - rest) * k;
};

// The haze: its peak luma at the top, easing to 0 at horizonHeight down.
export function horizon(y: number, line: number, peak: number): number {
  const t = y / (line * fieldSettings.horizonHeight);
  return t >= 1 ? 0 : peak * (1 - Math.max(0, t)) ** 2;
}

// A held key's light at d px above the line, as a fraction of spillAlpha: 1 at the line, 0 by spillPx.
export const spill = (d: number) => (d >= fieldSettings.spillPx ? 0 : (1 - Math.max(0, d) / fieldSettings.spillPx) ** 2);

// Interleaved gradient noise (Jimenez 2014): cheap, blue-ish, no texture to ship. 0 … 1.
export const noise = (x: number, y: number) => {
  const f = (v: number) => v - Math.floor(v);
  return f(52.9829189 * f(0.06711056 * x + 0.00583715 * y));
};

// A hairline 1 device pixel wide, centered on a device pixel.
export const snap = (v: number, dpr: number) => (Math.floor(v * dpr) + 0.5) / dpr;

// ---------- fever ----------

// fever-stage keeps its own state, and importing it would pull three.js into every page that draws a highway. So the
// field follows the same two events (fever-stage's reduceStage) and eases the same 400 ms.
let fever = { on: false, atMs: -Infinity };
export function feverHeat(nowMs: number, still = reducedMotion()): number {
  const t = Math.min(1, Math.max(0, (nowMs - fever.atMs) / fieldSettings.feverEaseMs));
  const heat = fever.on ? t : 1 - t;
  return still ? (fever.on ? 1 : 0) : heat;
}
export function onFieldEvent(e: GameEvent): void {
  if (e.type === "songStart" || e.type === "songEnd" || e.type === "quit") fever = { on: false, atMs: -Infinity };
  else if (e.type === "feverStart") fever = { on: true, atMs: e.atMs };
  else if (e.type === "feverEnd") fever = { on: false, atMs: e.atMs };
}
export const highwayField = (): GamePlugin => ({ id: "highway-field", onEvent: onFieldEvent });

// ---------- drawing ----------

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;
export interface Baked {
  key: string;
  calm: Surface; // the haze, dithered
  hot: Surface; // the haze in fever, dithered
  lines: Surface; // octave lines and seams
}
export interface FieldCache {
  baked: Baked | null;
  bakes: number;
  make: (w: number, h: number) => Surface;
}
const makeSurface = (w: number, h: number): Surface => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
// One slot, keyed by geometry, shared by every canvas: highlight-reel draws through a new scratch context each frame.
const shared: FieldCache = { baked: null, bakes: 0, make: makeSurface };

export const layoutKey = (L: Layout, dpr: number) =>
  [L.width, L.height, dpr, L.perspective, L.lowPitch, L.highPitch, L.keyX(L.lowPitch).x.toFixed(2)].join(" ");

const linePitches = (L: Layout) => {
  const out: { pitch: number; kind: LineKind }[] = [];
  for (let p = L.lowPitch; p <= L.highPitch; p++)
    if (p % 12 === 0) out.push({ pitch: p, kind: "octave" });
    else if (p % 12 === 5) out.push({ pitch: p, kind: "seam" });
  return out;
};

function bakeHaze(cache: FieldCache, L: Layout, dpr: number, color: string, peak: number): Surface {
  const line = L.judgmentLineY;
  const w = Math.max(1, Math.round(L.width * dpr));
  const h = Math.max(1, Math.ceil(line * fieldSettings.horizonHeight * dpr));
  const s = cache.make(w, h);
  const ctx = s.getContext("2d") as Ctx;
  const img = ctx.createImageData(w, h);
  const [r, g, b] = rgb(color);
  const k = 1 / luma(color); // alpha over black that gives a luma of 1
  for (let y = 0; y < h; y++) {
    const a = horizon((y + 0.5) / dpr, line, peak) * k * 255;
    if (a <= 0) continue;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.round(a + (noise(x, y) - 0.5) * fieldSettings.dither * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return s;
}

// The static layer, once per layout: the haze (calm and fever) and the octave lines and seams, each fading toward the
// top as the notes do.
export function bakeField(L: Layout, dpr: number, cache: FieldCache = shared): Baked {
  cache.bakes++;
  const line = L.judgmentLineY;
  const lines = cache.make(Math.max(1, Math.round(L.width * dpr)), Math.max(1, Math.round(L.height * dpr)));
  const ctx = lines.getContext("2d") as Ctx;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "lighten";
  ctx.lineWidth = 1 / dpr;
  for (const { pitch, kind } of linePitches(L)) {
    const x = L.keyX(pitch).x;
    const g = ctx.createLinearGradient(0, 0, 0, line);
    g.addColorStop(0, dim("#ffffff", lineAlpha(kind, 0, line)));
    g.addColorStop(1, dim("#ffffff", lineAlpha(kind, line, line)));
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(snap(L.project(x, 0), dpr), 0);
    ctx.lineTo(snap(x, dpr), line);
    ctx.stroke();
  }
  return {
    key: layoutKey(L, dpr),
    calm: bakeHaze(cache, L, dpr, fieldSettings.horizonColor, fieldSettings.horizonLuma),
    hot: bakeHaze(cache, L, dpr, fieldSettings.feverColor, fieldSettings.feverLuma),
    lines,
  };
}

export interface Light {
  pitch: number;
  color: string; // the key's light: its note's hand color, or white
  strength: number; // 1 while held, fading over key-polish's releaseMs after
}
export interface FieldState {
  nowMs: number;
  backdropAlpha?: number;
  barLines?: BarLine[];
  lights: Light[];
  heat?: number; // 0 … 1 fever; default from the field's own fever plugin
}

// Each frame: the fill, the baked layer, then the spill, bar lines with their downbeat, and bar-lines' numbers.
export function drawField(ctx: Ctx, L: Layout, s: FieldState, cache: FieldCache = shared): void {
  const line = L.judgmentLineY;
  const dpr = ("getTransform" in ctx && ctx.getTransform().a) || 1;
  const still = reducedMotion();
  const alpha = s.backdropAlpha ?? 1;
  if (alpha < 1) ctx.clearRect(0, 0, L.width, L.height); // a translucent fill would smear last frame
  ctx.fillStyle = alpha < 1 ? `rgba(0,0,0,${alpha})` : "#000";
  ctx.fillRect(0, 0, L.width, L.height);
  drawBlackKeyLanes(ctx as CanvasRenderingContext2D, L); // off (tint 0) unless Eric turns them back on

  const key = layoutKey(L, dpr);
  if (cache.baked?.key !== key) cache.baked = bakeField(L, dpr, cache);
  const { calm, hot, lines } = cache.baked;
  const hazeH = Math.ceil(line * fieldSettings.horizonHeight * dpr) / dpr;
  ctx.save();
  ctx.drawImage(calm, 0, 0, L.width, hazeH);
  const heat = s.heat ?? feverHeat(s.nowMs, still);
  if (heat > 0) {
    ctx.globalAlpha = heat;
    ctx.drawImage(hot, 0, 0, L.width, hazeH);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "lighten";
  ctx.drawImage(lines, 0, 0, L.width, L.height);

  // The spill: one light with the key's own, from the same color and release fade.
  for (const l of s.lights) {
    if (l.strength <= 0) continue;
    const k = L.keyX(l.pitch);
    const g = ctx.createLinearGradient(0, line, 0, line - fieldSettings.spillPx);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) g.addColorStop(t, dim(l.color, fieldSettings.spillAlpha * l.strength * spill(t * fieldSettings.spillPx)));
    ctx.fillStyle = g;
    ctx.fillRect(k.x, line - fieldSettings.spillPx, k.width, fieldSettings.spillPx);
  }

  if (s.barLines) {
    const pxPerMs = line / settings.lookaheadMs;
    ctx.lineWidth = 1 / dpr;
    for (const b of s.barLines) {
      const y = line - (b.atMs - s.nowMs) * pxPerMs;
      if (y < 0 || y > line) continue;
      const yy = snap(y, dpr);
      ctx.strokeStyle = dim("#ffffff", barAlpha(y, line, downbeat(b.atMs, s.nowMs, still)));
      ctx.beginPath();
      ctx.moveTo(L.project(0, y), yy);
      ctx.lineTo(L.project(L.width, y), yy);
      ctx.stroke();
    }
  }
  ctx.restore();
  if (s.barLines) drawBarLabels(ctx as CanvasRenderingContext2D, L, s.barLines, s.nowMs);
}
