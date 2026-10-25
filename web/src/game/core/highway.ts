// The highway: a flat-or-mildly-tilted lane per key, notes falling to the keyboard. Canvas 2D, no React.
import type { Chart, Frame, Hand, Judgment } from "../../contracts";
import type { BarLine } from "../bar-lines";
import { drawField } from "../highway-field";
import { noteColorFor } from "../hand-colors";
import { hitLinePath } from "../hit-line";
import { meterLayout } from "../fever-gauge";
import { whiteIndex as whiteIndexOf, type Range } from "../highway-zoom";
import { drawBlackKey, drawWhiteKey } from "../key-skin";
import { brightness, pillRect } from "../note-pills";
import { SpriteCache, bodyColor, drawChordHairlines, drawNote, lod, materialSettings, mix, type LeadingEnd } from "../note-material";
import { canvasFonts, kitSettings } from "../duo-tokens";
import { bg, flare, gold, good, ink, miss, primary, secondary, wrong } from "../ui-tokens";
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

// key-polish: the notes' body and glow, and the keys' release.
const sprites = new SpriteCache(); // note-material's bloom, shared by every canvas
export const notePolish = {
  glowMs: 400, // a note starts to glow this long before it lands
  glowPx: 18, // its glow at the line
  heldGlow: 0.35, // of glowPx, on a held note: a long one is a column, and a full glow down it reads as neon
  lift: 0.18, // white over a note's leading end, fading to none at its tail
  rim: "rgba(255,255,255,0.3)", // the fine light around a note's edge
  releaseMs: 140, // a released key's light fades over this; none under reduced motion
};

// Which keys were lit last frame, so a released key's light can fade instead of cut. Per canvas.
type Release = { light: string; atMs: number };
const lastLit = new WeakMap<CanvasRenderingContext2D, { lit: Map<number, string>; fading: Map<number, Release> }>();
function releases(ctx: CanvasRenderingContext2D, s: HighwayState, lit: (p: number) => string): Map<number, Release> {
  let r = lastLit.get(ctx);
  if (!r) lastLit.set(ctx, (r = { lit: new Map(), fading: new Map() }));
  if (!reducedMotion()) for (const [p, light] of r.lit) if (!s.pressed.has(p)) r.fading.set(p, { light, atMs: s.nowMs });
  r.lit.clear();
  for (const p of s.pressed) {
    r.lit.set(p, lit(p));
    r.fading.delete(p);
  }
  for (const [p, f] of r.fading) if (s.nowMs < f.atMs || s.nowMs - f.atMs >= notePolish.releaseMs) r.fading.delete(p);
  return r.fading;
}

export function drawHighway(ctx: CanvasRenderingContext2D, L: Layout, chart: Chart, s: HighwayState): void {
  const line = L.judgmentLineY;
  const beatMs = msPerBeat(chart.bpm);
  const pxPerMs = line / settings.lookaheadMs;

  // A key that hit a note lights in that note's color; one that hit nothing, white. Its light fades on release
  // (key-polish), and the field pools it up the lane (highway-field), so both read as one light.
  const color = noteColorFor(chart);
  const lit = (p: number) => {
    const hand = s.pressedHand?.get(p);
    return hand ? color(hand) : settings.keyLitColor;
  };
  const fading = releases(ctx, s, lit);
  const light = (p: number): [string | null, number] => {
    if (s.pressed.has(p)) return [lit(p), 1];
    const f = fading.get(p);
    return f ? [f.light, 1 - (s.nowMs - f.atMs) / notePolish.releaseMs] : [null, 1];
  };
  const lights = [...s.pressed, ...fading.keys()].map((pitch) => {
    const [c, strength] = light(pitch);
    return { pitch, color: c ?? settings.keyLitColor, strength };
  });
  // highway-field: the fill, haze, lane lines, spill, and bar lines with their downbeat, all under the notes.
  drawField(ctx, L, { nowMs: s.nowMs, backdropAlpha: s.backdropAlpha, barLines: s.barLines, lights });

  // Notes, clipped to the highway so they slide into the keys.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, L.width, line);
  ctx.clip();
  // note-material: the visible notes first, so the level of detail knows how dense the screen is and chords share a
  // hairline; then each note's material in one drawNote call.
  const shown: { n: (typeof chart.notes)[number]; state: Judgment | undefined; held: boolean; startMs: number; top: number; bottom: number }[] = [];
  for (const n of chart.notes) {
    const state = s.noteState.get(n.id);
    const startMs = n.beat * beatMs;
    const endMs = startMs + n.duration * beatMs;
    // A hit note is consumed, unless its key is still held: then what's left of it feeds into the key (key-polish).
    const held = state !== undefined && state !== "MISS" && s.pressed.has(n.pitch) && endMs > s.nowMs;
    if (state && state !== "MISS" && !held) continue;
    const yBottom = held ? line : line - (startMs - s.nowMs) * pxPerMs;
    const yTop = line - (endMs - s.nowMs) * pxPerMs;
    if (yBottom < 0 || yTop > line) continue;
    const top = held ? yTop + settings.noteGapPx : Math.min(yTop + settings.noteGapPx, yBottom - settings.noteHeadPx * 2);
    if (top >= yBottom - 2) continue; // a held note's last sliver
    shown.push({ n, state, held, startMs, top, bottom: yBottom - 1 });
  }
  const detail = lod(shown.length);
  const ratio = ctx.getTransform?.().a || 1;
  const reduced = reducedMotion();
  const ends: LeadingEnd[] = [];
  for (const { n, state, held, startMs, top, bottom } of shown) {
    const pill = pillRect(L.keyX(n.pitch), L.isBlack(n.pitch)); // a pill sized to its key (note-pills)
    const toHit = startMs - s.nowMs;
    const b = held ? 1 : brightness(toHit, settings.lookaheadMs);
    const hand = color(n.hand);
    const isBlack = L.isBlack(n.pitch);
    drawNote(ctx, L, pill, {
      top, bottom, hand, isBlack, brightness: b, msToHit: toHit, held, miss: state === "MISS", missColor: settings.missColor,
      long: n.duration >= materialSettings.longBeats, beatMs, pxPerMs, headPx: settings.noteHeadPx * 1.6,
      glowMs: notePolish.glowMs, heldGlow: notePolish.heldGlow, field: bg, pixelRatio: ratio, detail, reduced,
    }, s.nowMs, sprites);
    if (!held && state !== "MISS") ends.push({ startMs, x0: pill.x, x1: pill.x + pill.width, y: bottom, body: mix([0, 0, 0], bodyColor(hand, isBlack), b), hand: n.hand });
  }
  drawChordHairlines(ctx, L, ends, bg, ratio);
  ctx.restore();

  // Keyboard (key-skin): whites, pressed whites (so their glow lies over their neighbours), then blacks on top. Its
  // top edge is the judgment line.
  const kbH = L.keyboardHeight;
  for (const down of [false, true])
    for (let p = L.lowPitch; p <= L.highPitch; p++) {
      if (L.isBlack(p) || s.pressed.has(p) !== down) continue;
      const k = L.keyX(p);
      drawWhiteKey(ctx, { x: k.x + 0.5, y: line, w: k.width - 1, h: kbH }, ...light(p));
    }
  for (let p = L.lowPitch; p <= L.highPitch; p++) {
    if (!L.isBlack(p)) continue;
    const k = L.keyX(p);
    drawBlackKey(ctx, { x: k.x, y: line, w: k.width, h: kbH * 0.62 }, ...light(p));
  }
  // The hit line (hit-line): a gently moving white stroke with a soft glow, brighter over each pressed key in that
  // key's light. Flat under reduced motion.
  const path = hitLinePath(L.width, s.nowMs, reducedMotion());
  const trace = () => {
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p.x, line + p.dy) : ctx.moveTo(p.x, line + p.dy)));
  };
  ctx.save();
  // The keybed's soft shadow on the key tops, so the white line reads against white keys.
  const shade = ctx.createLinearGradient(0, line, 0, line + 10);
  shade.addColorStop(0, "rgba(0,0,0,0.6)");
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, line, L.width, 10);
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
