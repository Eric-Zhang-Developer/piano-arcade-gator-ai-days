// Arcade HUD in the Duo look: a bracketed song tag top left (BAR n / N and a progress line), a bracketed cluster top
// right (the multiplier, ACC and SCORE), and the combo itself at top centre under the band, NOSTALGIA-style, in the
// moment face (specs: hud, combo-hud, duo-hud; #1404).
// Driven by GameEvents and the clock; reduceHud and hudLayout are pure so tests can pin them.
import type { Chart, Frame, GameEvent, GamePlugin } from "../../contracts";
import { barLines, type BarLine } from "../bar-lines";
import { GOOD_WEIGHT, msPerBeat } from "../core/settings";
import { barReadout } from "../duo-hud/bar";
import { canvasFonts, drawBrackets, kitSettings } from "../duo-tokens";
import { feverHeat } from "../fever-arc";
import { isWaitMode } from "../wait-mode";
import { bg, gold, good, ink, inkDim, line as hairline, miss, panel, primary, tierX1, tierX2, tierX3, tierX4, wrong } from "../ui-tokens";

// visual-direction.md's --pa-line: ink-dim at about 25%, for the divider and the progress line's track.

export const hudSettings = {
  comboFrom: 5, // the combo number is fully shown from this combo, fading in from fadeFrom (hidden at 0 and 1)
  fadeFrom: 2,
  comboFraction: 0.15, // the numeral's em size, of the judgment line's height: about 130 px at 1080p (#1404)
  popMs: 110, // each increment ticks the numeral up and back; short, so a fast run reads as a pulse, not a jitter
  popScale: 1.08,
  feverColor: "#ffb02e", // fever's amber (fever-arc's wisps use the same): the numeral warms with fever's heat
  points: { PERFECT: 100, GREAT: 50, GOOD: 25 },
  // Guitar Hero 3's tier colors: white, orange, green, purple (decision hud-look).
  tiers: [
    { from: 0, mult: 1, color: tierX1 },
    { from: 10, mult: 2, color: tierX2 },
    { from: 20, mult: 3, color: tierX3 },
    { from: 30, mult: 4, color: tierX4 },
  ],
  // PERFECT, GOOD, MISS and WRONG per visual-direction. GREAT is ink: its old mint was a hand color, and judgments
  // never wear the hands' colors (decision duo-hud-great).
  judgmentColors: { PERFECT: gold, GREAT: ink, GOOD: good, MISS: miss, wrong },
  statusGutterPx: 120, // beat-track's status line ("Beat: piano", 13px) sits in the top-right corner
  safeFraction: 0.6, // nothing below this fraction of the judgment line: the lowest 40% is where notes land
  panelBg: panel,
  swellFrom: 50, // milestones from this count swell the combo (25 only gets juice-sound's stinger)
  rollMs: 200, // the score rolls to each new value (spec: score-rollup)
  flashMs: 250, // the multiplier badge flashes on a tier-up
  flashScale: 1.15,
  swellMs: 250,
  swellScale: 1.25,
  ghostMs: 1000,
  ghostScale: 1.6,
  ghostAlpha: 0.3,
  font: "system-ui, sans-serif", // other plugins' labels in the band; the HUD's own use the data and display faces
};

// ---------- state ----------

export interface HudState {
  PERFECT: number;
  GREAT: number;
  GOOD: number;
  MISS: number;
  wrong: number;
  extra: number; // not shown (the spec counts WRONG notes); verify-hud checks it
  combo: number;
  score: number;
  milestone: { count: number; atMs: number } | null;
}

export const emptyHud = (): HudState => ({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0, extra: 0, combo: 0, score: 0, milestone: null });

export const tierFor = (combo: number) => hudSettings.tiers.findLast((t) => combo >= t.from)!;

// Pips toward the next tier: filled of 10; full at the top tier.
export function tierProgress(combo: number): { filled: number; of: number } {
  const tiers = hudSettings.tiers;
  const i = tiers.indexOf(tierFor(combo));
  if (i === tiers.length - 1) return { filled: 10, of: 10 };
  const span = tiers[i + 1].from - tiers[i].from;
  return { filled: Math.round(((combo - tiers[i].from) / span) * 10), of: 10 };
}

// A hit scores at the multiplier its combo had before it (Guitar Hero: the 10th hit is still x1). The judge sends
// noteHit before the combo event that counts it, so state.combo here is the combo before this hit.
export function reduceHud(s: HudState, e: GameEvent): HudState {
  switch (e.type) {
    case "songStart":
      return emptyHud();
    case "noteHit":
      return { ...s, [e.judgment]: s[e.judgment] + 1, score: s.score + hudSettings.points[e.judgment] * tierFor(s.combo).mult };
    case "combo":
      return { ...s, combo: e.count };
    case "noteMiss":
      return { ...s, MISS: s.MISS + 1, combo: 0 };
    case "extra":
      return { ...s, extra: s.extra + 1 };
    case "wrongNote": // sent after its extra; breaks the combo like a MISS
      return { ...s, wrong: s.wrong + 1, combo: 0 };
    case "comboMilestone":
      return { ...s, milestone: { count: e.count, atMs: e.atMs } };
    default:
      return s;
  }
}

// ---------- score roll-up and tier flash (spec: score-rollup) ----------

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

// The score shown elapsedMs into a roll from `from` to `to`: whole, from `from` at 0 to exactly `to` at rollMs,
// never past it. A roll down (a new take) jumps.
export function rollup(from: number, to: number, elapsedMs: number): number {
  if (to <= from) return to;
  const t = Math.min(1, Math.max(0, elapsedMs / hudSettings.rollMs));
  return from + Math.floor((to - from) * easeOutCubic(t));
}

// The badge's flash, 1 at a tier-up fading to 0 at flashMs (0 before it, too).
export function tierFlash(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= hudSettings.flashMs) return 0;
  return (1 - elapsedMs / hudSettings.flashMs) ** 2;
}

// ---------- layout (CSS px) ----------

export interface HudSlot {
  x0: number;
  x1: number;
}

export interface HudBox extends HudSlot {
  y0: number;
  y1: number;
}

export interface HudLayout {
  panel: { h: number };
  // Two bracketed clusters in the band (spec: duo-hud): the song tag top left, the combo cluster top right, left of
  // beat-track's gutter. slots.card is the tag's span, where watch-demo's DEMO badge sits.
  slots: { card: HudSlot };
  tag: HudBox;
  cluster: HudBox;
  combo: { cx: number; cy: number; size: number; room: number; labelY: number }; // top centre: the numeral's centre, em size and width; COMBO above it
  stack: { x: number; rows: [number, number, number]; px: number }; // COMBO, ACC and SCORE, left-aligned at x
  safeY: number; // nothing drawn below this
}

export function hudLayout(width: number, judgmentLineY: number): HudLayout {
  const L = judgmentLineY;
  const h = Math.max(44, Math.min(84, L * 0.11));
  const pad = Math.max(10, h * 0.25);
  const m = Math.max(5, h * 0.1);
  const [y0, y1] = [m, h - m];
  const tag = { x0: pad, x1: Math.min(width * 0.36, pad + h * 6.2), y0, y1 };
  const cx1 = width - hudSettings.statusGutterPx - pad * 0.5;
  const cluster = { x0: cx1 - h * 2.65, x1: cx1, y0, y1 };
  const size = Math.max(36, L * hudSettings.comboFraction);
  const labelPx = h * 0.19;
  const labelY = h + labelPx * 1.4;
  return {
    panel: { h },
    slots: { card: { x0: tag.x0, x1: tag.x1 } },
    tag,
    cluster,
    combo: { cx: width / 2, cy: labelY + labelPx * 0.8 + size * 0.42, size, room: Math.min(width * 0.24, size * 2.2), labelY },
    stack: { x: cluster.x0 + h * 0.3, rows: [h * 0.26, h * 0.5, h * 0.74], px: labelPx },
    safeY: L * hudSettings.safeFraction,
  };
}

// The lowest point the HUD reaches: the band, or the combo under it at top centre (its swell and ghost may pass it).
export function hudBottom(l: HudLayout): number {
  return Math.max(l.panel.h, l.combo.cy + l.combo.size * 0.5);
}

// The combo's opacity: hidden at 0 and 1, fading in over fadeFrom..comboFrom.
export function comboAlpha(combo: number): number {
  const { fadeFrom, comboFrom } = hudSettings;
  return Math.min(1, Math.max(0, (combo - fadeFrom + 1) / (comboFrom - fadeFrom + 1)));
}

// "#rrggbb" a to b by k (0–1), as "#rrggbb".
export function mixHex(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * Math.min(1, Math.max(0, k))).toString(16).padStart(2, "0")).join("");
}

// Live accuracy, the judge's formula over the notes judged so far: null before the first.
export function liveAccuracy(s: HudState): number | null {
  const judged = s.PERFECT + s.GREAT + s.GOOD + s.MISS + s.wrong;
  return judged === 0 ? null : (s.PERFECT + 0.5 * s.GREAT + GOOD_WEIGHT * s.GOOD) / judged;
}

// ---------- drawing ----------

interface Tag {
  title: string;
  bar: { n: number; N: number };
  progress: number; // 0–1, the clock over the chart's end
}

// Draws at (x, y), shrunk to fit down to 60%, then cut with an ellipsis.
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, font: (px: number) => string): void {
  const set = (p: number) => (ctx.font = font(Math.round(p)));
  set(px);
  const w = ctx.measureText(text).width;
  if (w > maxW) set(Math.max(px * 0.6, (px * maxW) / w));
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
  ctx.fillText(t, x, y);
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Monospace caps with wide tracking: the kit's data type.
function data(ctx: CanvasRenderingContext2D, px: number): void {
  ctx.font = canvasFonts.data(Math.round(px));
  ctx.letterSpacing = kitSettings.dataTracking;
}

// wait: a wait-mode take isn't scored, so the band holds the song tag only (wait-hud draws its own count into it).
// shown: the score on screen (mid-roll); flash: the multiplier's tier-up flash, 0–1; pop: the last increment's tick, 0–1.
function drawHud(ctx: CanvasRenderingContext2D, f: Frame, s: HudState, tag: Tag | null, wait = false, shown = s.score, flash = 0, pop = 0): void {
  const l = hudLayout(f.width, f.judgmentLineY);
  const { h } = l.panel;
  const tier = wait ? hudSettings.tiers[0] : tierFor(s.combo);

  // The band, opaque: notes and labels below draw from y = 0 (#243). The playfield's own black, so the clusters float.
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, f.width, h);
  ctx.textBaseline = "middle";

  // Top left: the song tag. The title, a divider, BAR n / N, and the progress line under them.
  if (tag) {
    const { x0, x1, y0, y1 } = l.tag;
    const bh = y1 - y0;
    const inset = bh * 0.32;
    drawBrackets(ctx, x0, y0, x1 - x0, bh); // the kit's defaults, so every screen's brackets match
    const row = y0 + bh * 0.4;
    const px = h * 0.21;
    data(ctx, px);
    ctx.fillStyle = inkDim;
    ctx.textAlign = "right";
    const bar = `BAR ${tag.bar.n} / ${tag.bar.N}`;
    ctx.fillText(bar, x1 - inset, row);
    const barW = ctx.measureText(bar).width;
    const divX = x1 - inset - barW - px * 0.9;
    ctx.fillStyle = hairline;
    ctx.fillRect(Math.round(divX), row - px * 0.6, 1, px * 1.2);
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    data(ctx, px);
    fitText(ctx, tag.title.toUpperCase(), x0 + inset, row, divX - px * 0.9 - (x0 + inset), px, canvasFonts.data);
    const ly = Math.round(y0 + bh * 0.76);
    const lw = x1 - x0 - inset * 2;
    ctx.fillStyle = hairline;
    ctx.fillRect(x0 + inset, ly, lw, 2);
    ctx.fillStyle = primary;
    ctx.fillRect(x0 + inset, ly, lw * Math.min(1, Math.max(0, tag.progress)), 2);
    ctx.letterSpacing = "0px";
  }

  if (wait) return;

  // Top right: the cluster. COMBO with the multiplier, ACC and SCORE; the numeral itself is at top centre.
  const c = l.cluster;
  drawBrackets(ctx, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
  drawCenterCombo(ctx, f, l, s, pop);

  const { x, rows, px } = l.stack;
  const room = c.x1 - x - (c.y1 - c.y0) * 0.2;
  ctx.textAlign = "left";
  data(ctx, px);
  ctx.fillStyle = primary;
  ctx.fillText("COMBO", x, rows[0]);
  const comboW = ctx.measureText("COMBO").width;
  // The multiplier in its tier color; a tier-up glows it, settling from a little larger.
  ctx.save();
  ctx.fillStyle = tier.color;
  const bx = x + comboW + px * 0.8;
  if (flash > 0) {
    ctx.shadowColor = tier.color;
    ctx.shadowBlur = h * 0.3 * flash;
    const k = 1 + (hudSettings.flashScale - 1) * flash;
    ctx.translate(bx, rows[0]);
    ctx.scale(k, k);
    ctx.translate(-bx, -rows[0]);
  }
  ctx.fillText(`x${tier.mult}`, bx, rows[0]);
  ctx.restore();
  const acc = liveAccuracy(s);
  const line = (label: string, value: string, y: number) => {
    data(ctx, px);
    ctx.fillStyle = inkDim;
    ctx.fillText(label, x, y);
    const lw = ctx.measureText(`${label} `).width;
    ctx.fillStyle = ink;
    fitText(ctx, value, x + lw, y, room - lw, px, canvasFonts.data);
  };
  line("ACC", acc === null ? "—" : `${(acc * 100).toFixed(1)}%`, rows[1]);
  line("SCORE", shown.toLocaleString("en-US"), rows[2]);
  ctx.letterSpacing = "0px";
}

// The combo at top centre (#1404): a small COMBO label over the numeral in the moment face, the milestone's ghost
// swelling behind it, a tick on each increment, and fever's amber. Hidden at 0; miss-moment draws a break here.
function drawCenterCombo(ctx: CanvasRenderingContext2D, f: Frame, l: HudLayout, s: HudState, pop: number): void {
  const alpha = comboAlpha(s.combo);
  const still = reducedMotion();
  const m = s.milestone && s.milestone.count >= hudSettings.swellFrom && !still ? s.milestone : null;
  const t = m ? f.nowMs - m.atMs : Infinity;
  const color = mixHex(primary, hudSettings.feverColor, feverHeat());
  if (m && t >= 0 && t < hudSettings.ghostMs) {
    const k = t / hudSettings.ghostMs;
    drawCombo(ctx, l, String(m.count), 1 + (hudSettings.ghostScale - 1) * k, hudSettings.ghostAlpha * (1 - k), color);
  }
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  data(ctx, l.stack.px);
  ctx.fillStyle = inkDim;
  ctx.textAlign = "center";
  ctx.fillText("COMBO", l.combo.cx, l.combo.labelY);
  ctx.letterSpacing = "0px";
  const swell = t >= 0 && t < hudSettings.swellMs ? 1 + (hudSettings.swellScale - 1) * Math.sin((Math.PI * t) / hudSettings.swellMs) : 1;
  const tick = still ? 1 : 1 + (hudSettings.popScale - 1) * pop;
  drawCombo(ctx, l, String(s.combo), swell * tick, alpha, color);
}

// The combo's numeral in the moment face, sized for three digits so it doesn't jump at 100, shrunk to its room.
function drawCombo(ctx: CanvasRenderingContext2D, l: HudLayout, text: string, scale: number, alpha: number, color: string): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "0px";
  let px = l.combo.size;
  ctx.font = canvasFonts.moment(Math.round(px));
  const w = ctx.measureText(text.length < 3 ? "888" : text).width;
  if (w > l.combo.room) px *= l.combo.room / w;
  ctx.font = canvasFonts.moment(Math.round(px * scale));
  ctx.fillText(text, l.combo.cx, l.combo.cy);
  ctx.globalAlpha = 1;
}

// ---------- the plugin ----------

declare global {
  interface Window {
    __pianoArcadeHud?: HudState & { bar: number; bars: number }; // read by verify-hud.mjs
  }
}

export function hud(): GamePlugin {
  let state = emptyHud();
  // The roll and the flash live here, not in HudState, so the score there stays exact at every event.
  let roll = { from: 0, to: 0, atMs: 0 };
  let tierUpAt: number | null = null;
  let popAt: number | null = null; // the last increment, for the numeral's tick
  let title: string | null = null;
  let lines: BarLine[] = [];
  let endMs = 1;
  let wait = false;
  let bar = { n: 0, N: 0 };
  const publish = () => {
    if (typeof window !== "undefined") window.__pianoArcadeHud = { ...state, bar: bar.n, bars: bar.N };
  };
  return {
    id: "hud",
    transformChart(chart: Chart, params: URLSearchParams) {
      wait = isWaitMode(params);
      title = chart.title;
      lines = barLines(chart, params); // after bar-loop in layers.ts: the chart /play plays, as bar-lines draws it
      endMs = Math.max(1, ...chart.notes.map((n) => (n.beat + n.duration) * msPerBeat(chart.bpm)));
      bar = barReadout(lines, 0);
      return chart;
    },
    onEvent(e) {
      const before = state;
      state = reduceHud(state, e);
      if (e.type === "songStart") {
        roll = { from: 0, to: 0, atMs: e.atMs };
        tierUpAt = null;
        popAt = null;
      } else if (state.score !== roll.to) {
        roll = { from: rollup(roll.from, roll.to, e.atMs - roll.atMs), to: state.score, atMs: e.atMs }; // from what's shown
      }
      if (tierFor(state.combo).mult > tierFor(before.combo).mult) tierUpAt = e.atMs;
      if (state.combo > before.combo) popAt = e.atMs;
      publish();
    },
    draw(ctx, frame) {
      const still = reducedMotion();
      const shown = still ? state.score : rollup(roll.from, roll.to, frame.nowMs - roll.atMs);
      const flash = still || tierUpAt === null ? 0 : tierFlash(frame.nowMs - tierUpAt);
      const next = barReadout(lines, frame.nowMs);
      if (next.n !== bar.n || next.N !== bar.N) {
        bar = next;
        publish();
      }
      const tag = title === null ? null : { title, bar, progress: frame.nowMs / endMs };
      const since = popAt === null ? Infinity : frame.nowMs - popAt;
      const pop = since >= 0 && since < hudSettings.popMs ? (1 - since / hudSettings.popMs) ** 2 : 0;
      drawHud(ctx, frame, state, tag, wait, shown, flash, pop);
    },
  };
}
