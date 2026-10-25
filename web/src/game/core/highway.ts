// The highway: a flat-or-mildly-tilted lane per key, notes falling to the keyboard. Canvas 2D, no React.
import type { Chart, Frame, Hand, Judgment } from "../../contracts";
import { drawBarLines, type BarLine } from "../bar-lines";
import { drawBlackKeyLanes } from "../black-key-lanes";
import { noteColorFor } from "../hand-colors";
import { hitLinePath } from "../hit-line";
import { meterLayout } from "../fever-gauge";
import { whiteIndex as whiteIndexOf, type Range } from "../highway-zoom";
import { drawBlackKey, drawWhiteKey } from "../key-skin";
import { brightness, pillRect } from "../note-pills";
import { canvasFonts, kitSettings } from "../duo-tokens";
import { flare, gold, good, ink, miss, primary, secondary, wrong } from "../ui-tokens";
import { staticRange, type KeyRange } from "./range";
import { msPerBeat, settings } from "./settings";

export { staticRange, type KeyRange } from "./range";

const JUDGMENT_SHOW_MS = 600;
// Keyed by name, not Record<Judgment>, so a judgment added to the contract doesn't break the build first.
// The HUD's judgment colors (ui-tokens). GREAT is ink, as on the HUD: a hand color would read as a note (duo-hud).
const JUDGMENT_COLORS: Record<string, string> = { PERFECT: gold, GREAT: ink, GOOD: good, MISS: miss, WRONG: wrong };
const JUDGMENT_POP_MS = 120; // the word lands slightly large and settles; none under reduced motion

// Where the judgment word goes: top center, just under the HUD's band (its panel and the fever strip), where notes are
// dim and over a second from the line. It lies over the giant combo, which the HUD keeps faint (20%) so things read
// through it; under the combo instead, it covered bright notes under a second away (the #244 complaint). The readout
// under the word is its lowest line; bottom is where that ends.
export function judgmentPlace(width: number, judgmentLineY: number) {
  const size = Math.max(18, Math.round(judgmentLineY * 0.045)); // the frame's small spaced word, 24 px+ at 1920
  const meter = meterLayout(width, judgmentLineY).bar;
  const cy = meter.y + meter.h + size * 0.8;
  return { cx: width / 2, cy, size, readoutY: cy + size * 0.85, bottom: cy + size * 1.1 };
}
const BLACK_KEY_WIDTH = 0.6; // × white key width
const MAX_PERSPECTIVE = 0.3;

export interface Layout extends Omit<Frame, "nowMs"> {
  isBlack(pitch: number): boolean;
  keyboardHeight: number;
  perspective: number;
  project(x: number, y: number): number; // x at the judgment line -> x at height y (perspective)
}

export interface HighwayState {
  nowMs: number; // chart clock
  noteState: Map<string, Judgment>; // judged notes
  pressed: Set<number>; // pitches held right now
  pressedHand?: Map<number, Hand>; // a held key's hand, when its press hit a note (hand-colors); absent: today's color
  latest: { judgment: Judgment | "WRONG"; offsetMs: number | null; atMs: number } | null;
  countInBeat: number | null; // 1..countInBeats while counting in, else null
  backdropAlpha?: number; // below 1 while a background layer is mounted; default opaque
  barLines?: BarLine[]; // bar-lines: a faint line per bar start, under the notes; absent draws none
}

// Read once and kept live, so a frame doesn't build a new query; absent (tests, server) means motion is fine.
let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

export const isBlack = (pitch: number) => [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
// The white key one step away. A black key's neighbours are always white.

const WHITE_IN_OCTAVE = [0, 2, 4, 5, 7, 9, 11];
const whitePitch = (k: number) => Math.floor(k / 7) * 12 + WHITE_IN_OCTAVE[((k % 7) + 7) % 7]; // inverse of whiteIndex

// view (highway-zoom): the visible range in white-key units, [lo, hi), fractional while it eases. The keyboard height
// stays the whole chart's, so the judgment line never moves while the view pans and zooms. Without a view: today's.
// `keys` is the take's static range. /play passes the one from the chart as loaded, so `hands=` or a loop, which
// leave fewer notes, keep the song's keyboard (spec: static-keyboard).
export function makeLayout(
  chart: Chart,
  width: number,
  height: number,
  perspective: number,
  view?: Range,
  keys: KeyRange = staticRange(chart),
): Layout {
  const { lowPitch, highPitch } = keys;

  const whiteIndex = new Map<number, number>();
  for (let p = lowPitch; p <= highPitch; p++) if (!isBlack(p)) whiteIndex.set(p, whiteIndex.size);
  const whiteW = width / whiteIndex.size;
  const w0 = whiteIndexOf(lowPitch); // the lowest key's white index: whiteIndex.get(p) is whiteIndexOf(p) - w0
  const blackW = whiteW * BLACK_KEY_WIDTH;

  const keyboardHeight = Math.min(height * 0.22, whiteW * 4.5);
  const judgmentLineY = height - keyboardHeight;
  const p = Math.max(0, Math.min(MAX_PERSPECTIVE, perspective));
  const cx = width / 2;

  if (view) {
    const vw = width / (view.hi - view.lo);
    const vb = vw * BLACK_KEY_WIDTH;
    const x = (pitch: number) => (whiteIndexOf(pitch) - view.lo) * vw;
    return {
      lowPitch: whitePitch(Math.floor(view.lo)),
      highPitch: whitePitch(Math.ceil(view.hi) - 1),
      judgmentLineY,
      width,
      height,
      keyboardHeight,
      perspective: p,
      isBlack,
      keyX: (pitch) => (isBlack(pitch) ? { x: x(pitch - 1) + vw - vb / 2, width: vb } : { x: x(pitch), width: vw }),
      project(px, y) {
        const t = Math.max(0, Math.min(1, y / judgmentLineY));
        return cx + (px - cx) * (1 - p * (1 - t));
      },
    };
  }

  return {
    lowPitch,
    highPitch,
    judgmentLineY,
    width,
    height,
    keyboardHeight,
    perspective: p,
    isBlack,
    // Any pitch, not just the chart's: a key pressed outside the range lies off-screen instead of at NaN, which threw
    // in createRadialGradient and stopped the game (the hit-line glow, juice and ghost all ask for pressed keys).
    keyX(pitch) {
      if (!isBlack(pitch)) return { x: (whiteIndexOf(pitch) - w0) * whiteW, width: whiteW };
      return { x: (whiteIndexOf(pitch - 1) - w0 + 1) * whiteW - blackW / 2, width: blackW };
    },
    project(x, y) {
      const t = Math.max(0, Math.min(1, y / judgmentLineY));
      return cx + (x - cx) * (1 - p * (1 - t));
    },
  };
}

// A rounded quad from x-range [x0, x1] (at the line) between yTop and yBottom, through the perspective. Fills it
// unless fill is false (the path is left for a clip).
function bar(ctx: CanvasRenderingContext2D, L: Layout, x0: number, x1: number, yTop: number, yBottom: number, radius = 6, fill = true) {
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
  if (fill) ctx.fill();
}

export function drawHighway(ctx: CanvasRenderingContext2D, L: Layout, chart: Chart, s: HighwayState): void {
  const line = L.judgmentLineY;
  const beatMs = msPerBeat(chart.bpm);
  const pxPerMs = line / settings.lookaheadMs;

  const alpha = s.backdropAlpha ?? 1;
  if (alpha < 1) ctx.clearRect(0, 0, L.width, L.height); // a translucent fill would smear last frame
  ctx.fillStyle = alpha < 1 ? `rgba(0,0,0,${alpha})` : "#000";
  ctx.fillRect(0, 0, L.width, L.height);
  drawBlackKeyLanes(ctx, L); // the lanes under black keys a shade lighter, under everything else

  // Faint octave lines at each C, so the lanes read against the keys.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let p = L.lowPitch; p <= L.highPitch; p++) {
    if (p % 12 !== 0) continue;
    const x = L.keyX(p).x;
    ctx.beginPath();
    ctx.moveTo(L.project(x, 0), 0);
    ctx.lineTo(x, line);
    ctx.stroke();
  }
  if (s.barLines) drawBarLines(ctx, L, s.barLines, s.nowMs);

  // Notes, clipped to the highway so they slide into the keys.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, L.width, line);
  ctx.clip();
  const color = noteColorFor(chart);
  for (const n of chart.notes) {
    const state = s.noteState.get(n.id);
    if (state && state !== "MISS") continue; // consumed on hit
    const startMs = n.beat * beatMs;
    const yBottom = line - (startMs - s.nowMs) * pxPerMs;
    const yTop = line - (startMs + n.duration * beatMs - s.nowMs) * pxPerMs;
    if (yBottom < 0 || yTop > line) continue;
    // A pill sized to its key (note-pills), dim far from the line and full brightness at it. Dimmed by alpha over a
    // black underlay, so the hand's color stays exact and a background layer never shows through a far note.
    const pill = pillRect(L.keyX(n.pitch), L.isBlack(n.pitch));
    const x1 = pill.x;
    const x2 = pill.x + pill.width;
    const top = Math.min(yTop + settings.noteGapPx, yBottom - settings.noteHeadPx * 2);
    const b = state === "MISS" ? 1 : brightness(startMs - s.nowMs, settings.lookaheadMs);
    if (b < 1) {
      ctx.fillStyle = "#000";
      bar(ctx, L, x1, x2, top, yBottom - 1, pill.radius);
      ctx.globalAlpha = b;
    }
    ctx.fillStyle = state === "MISS" ? settings.missColor : color(n.hand);
    bar(ctx, L, x1, x2, top, yBottom - 1, pill.radius);
    if (state !== "MISS") {
      // The head is the pill's leading edge, clipped to its rounded end.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = settings.noteHeadColor;
      ctx.fillRect(0, yBottom - 1 - settings.noteHeadPx, L.width, settings.noteHeadPx);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Keyboard (key-skin): whites, pressed whites (so their glow lies over their neighbours), then blacks on top. Its
  // top edge is the judgment line. A key that hit a note lights in that note's color; one that hit nothing, white.
  const lit = (p: number) => {
    const hand = s.pressedHand?.get(p);
    return hand ? color(hand) : settings.keyLitColor;
  };
  const kbH = L.keyboardHeight;
  for (const down of [false, true])
    for (let p = L.lowPitch; p <= L.highPitch; p++) {
      if (L.isBlack(p) || s.pressed.has(p) !== down) continue;
      const k = L.keyX(p);
      drawWhiteKey(ctx, { x: k.x + 0.5, y: line, w: k.width - 1, h: kbH }, down ? lit(p) : null);
    }
  for (let p = L.lowPitch; p <= L.highPitch; p++) {
    if (!L.isBlack(p)) continue;
    const k = L.keyX(p);
    drawBlackKey(ctx, { x: k.x, y: line, w: k.width, h: kbH * 0.62 }, s.pressed.has(p) ? lit(p) : null);
  }
  // The hit line (hit-line): a gently moving white stroke with a soft glow, brighter over each pressed key in that
  // key's light. Flat under reduced motion.
  const path = hitLinePath(L.width, s.nowMs, reducedMotion());
  const trace = () => {
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p.x, line + p.dy) : ctx.moveTo(p.x, line + p.dy)));
  };
  ctx.save();
  // A soft shadow on the key tops, so the white line reads against white keys.
  const shade = ctx.createLinearGradient(0, line, 0, line + 8);
  shade.addColorStop(0, "rgba(0,0,0,0.6)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, line, L.width, 8);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Its glow: purple at the left (the left hand's side) to blue at the right, faint and wide, then narrower.
  const glow = ctx.createLinearGradient(0, 0, L.width, 0);
  glow.addColorStop(0, secondary);
  glow.addColorStop(1, primary);
  ctx.strokeStyle = glow;
  for (const [w, a] of [[14, 0.22], [5, 0.5]]) {
    trace();
    ctx.globalAlpha = a;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of s.pressed) {
    const k = L.keyX(p);
    const cx = k.x + k.width / 2;
    const lamp = ctx.createRadialGradient(cx, line, 0, cx, line, k.width * 1.2);
    lamp.addColorStop(0, "rgba(255,255,255,0.95)");
    lamp.addColorStop(0.3, lit(p));
    lamp.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.ellipse(cx, line, k.width * 1.2, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The line itself: white-hot, 2 px.
  trace();
  ctx.strokeStyle = flare;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (s.countInBeat !== null) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.round(line * 0.3)}px system-ui, sans-serif`;
    ctx.fillText(String(s.countInBeat), L.width / 2, line * 0.45);
  }

  // The judgment word under the HUD's band (judgmentPlace): off the notes' path near the line. The flare at the key
  // stays the feedback at the line.
  const t = s.latest ? s.nowMs - s.latest.atMs : Infinity;
  if (s.latest && t >= 0 && t < JUDGMENT_SHOW_MS) {
    const { judgment, offsetMs } = s.latest;
    const { cx, cy, size, readoutY } = judgmentPlace(L.width, line);
    const pop = reducedMotion() || t >= JUDGMENT_POP_MS ? 1 : 1.15 - 0.15 * (t / JUDGMENT_POP_MS);
    const fade = Math.min(1, (JUDGMENT_SHOW_MS - t) / 150);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = JUDGMENT_COLORS[judgment];
    // The kit's display face, upright, in spaced caps; the ms in its monospace (the frame's PERFECT / -3 MS).
    ctx.font = canvasFonts.display(Math.round(size * pop));
    ctx.letterSpacing = "0.12em";
    ctx.fillText(judgment, cx, cy);
    if (offsetMs !== null) {
      const ms = Math.round(offsetMs);
      ctx.font = canvasFonts.data(Math.round(size * 0.5));
      ctx.letterSpacing = kitSettings.dataTracking;
      const signed = `${ms > 0 ? "+" : ""}${ms} MS`;
      // GREAT and GOOD say which way you were off; PERFECT just shows the ms.
      const label = judgment === "PERFECT" ? signed : `${offsetMs < 0 ? "EARLY" : "LATE"} ${signed}`;
      ctx.fillText(label, cx, readoutY);
    }
    ctx.restore();
  }
}
