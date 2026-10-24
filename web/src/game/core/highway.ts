// The highway: a flat-or-mildly-tilted lane per key, notes falling to the keyboard. Canvas 2D, no React.
import type { Chart, Frame, Hand, Judgment } from "../../contracts";
import { noteColorFor } from "../hand-colors";
import { whiteIndex as whiteIndexOf, type Range } from "../highway-zoom";
import { brightness, pillRect } from "../note-pills";
import { msPerBeat, settings } from "./settings";

const JUDGMENT_SHOW_MS = 600;
// Keyed by name, not Record<Judgment>, so a judgment added to the contract doesn't break the build first.
const JUDGMENT_COLORS: Record<string, string> = {
  PERFECT: "#ffe27a",
  GREAT: "#5ef2c4",
  GOOD: "#7ab8ff",
  MISS: "#c98a9a",
  WRONG: "#ff3b4e",
};
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
}

export const isBlack = (pitch: number) => [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
// The white key one step away. A black key's neighbours are always white.
const whiteBelow = (p: number) => (isBlack(p - 1) ? p - 2 : p - 1);
const whiteAbove = (p: number) => (isBlack(p + 1) ? p + 2 : p + 1);

const WHITE_IN_OCTAVE = [0, 2, 4, 5, 7, 9, 11];
const whitePitch = (k: number) => Math.floor(k / 7) * 12 + WHITE_IN_OCTAVE[((k % 7) + 7) % 7]; // inverse of whiteIndex

// view (highway-zoom): the visible range in white-key units, [lo, hi), fractional while it eases. The keyboard height
// stays the whole chart's, so the judgment line never moves while the view pans and zooms. Without a view: today's.
export function makeLayout(chart: Chart, width: number, height: number, perspective: number, view?: Range): Layout {
  const pitches = chart.notes.map((n) => n.pitch);
  const lo = Math.min(...pitches);
  const hi = Math.max(...pitches);
  const lowPitch = whiteBelow(isBlack(lo) ? lo - 1 : lo);
  const highPitch = whiteAbove(isBlack(hi) ? hi + 1 : hi);

  const whiteIndex = new Map<number, number>();
  for (let p = lowPitch; p <= highPitch; p++) if (!isBlack(p)) whiteIndex.set(p, whiteIndex.size);
  const whiteW = width / whiteIndex.size;
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
    keyX(pitch) {
      if (!isBlack(pitch)) return { x: whiteIndex.get(pitch)! * whiteW, width: whiteW };
      return { x: (whiteIndex.get(pitch - 1)! + 1) * whiteW - blackW / 2, width: blackW };
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

  // Keyboard: whites, then blacks on top. Its top edge is the judgment line. A key that hit a note lights in that
  // note's color; a key that hit nothing lights as before.
  const lit = (p: number) => {
    const hand = s.pressedHand?.get(p);
    return hand ? color(hand) : settings.keyLitColor;
  };
  const kbH = L.keyboardHeight;
  for (let p = L.lowPitch; p <= L.highPitch; p++) {
    if (L.isBlack(p)) continue;
    const k = L.keyX(p);
    ctx.fillStyle = s.pressed.has(p) ? lit(p) : "#e8e8ec";
    ctx.fillRect(k.x + 0.5, line, k.width - 1, kbH);
  }
  for (let p = L.lowPitch; p <= L.highPitch; p++) {
    if (!L.isBlack(p)) continue;
    const k = L.keyX(p);
    ctx.fillStyle = s.pressed.has(p) ? lit(p) : "#16161a";
    ctx.fillRect(k.x, line, k.width, kbH * 0.62);
  }
  ctx.fillStyle = settings.noteColor;
  ctx.fillRect(0, line - 1, L.width, 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (s.countInBeat !== null) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `bold ${Math.round(line * 0.3)}px system-ui, sans-serif`;
    ctx.fillText(String(s.countInBeat), L.width / 2, line * 0.45);
  }

  if (s.latest && s.nowMs - s.latest.atMs < JUDGMENT_SHOW_MS) {
    const { judgment, offsetMs } = s.latest;
    const size = Math.max(18, Math.round(line * 0.07));
    ctx.fillStyle = JUDGMENT_COLORS[judgment];
    ctx.font = `bold ${size}px system-ui, sans-serif`;
    ctx.fillText(judgment, L.width / 2, line - size * 2);
    if (offsetMs !== null) {
      const ms = Math.round(offsetMs);
      ctx.font = `${Math.round(size * 0.55)}px system-ui, sans-serif`;
      const signed = `${ms > 0 ? "+" : ""}${ms} ms`;
      // GREAT and GOOD say which way you were off; PERFECT just shows the ms.
      const label = judgment === "PERFECT" ? signed : `${offsetMs < 0 ? "EARLY" : "LATE"} ${signed}`;
      ctx.fillText(label, L.width / 2, line - size * 0.9);
    }
  }
}
