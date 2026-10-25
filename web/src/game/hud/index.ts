// Arcade HUD in the Duo look: a bracketed song tag top left (BAR n / N and a progress line) and a bracketed combo
// cluster top right (the combo, its multiplier, ACC and SCORE), in the band up top (specs: hud, combo-hud, duo-hud).
// Driven by GameEvents and the clock; reduceHud and hudLayout are pure so tests can pin them.
import type { Chart, Frame, GameEvent, GamePlugin } from "../../contracts";
import { barLines, type BarLine } from "../bar-lines";
import { GOOD_WEIGHT, msPerBeat } from "../core/settings";
import { barReadout } from "../duo-hud/bar";
import { drawBrackets } from "../duo-hud/brackets";
import { isWaitMode } from "../wait-mode";
import { bg, gold, good, handR, ink, inkDim, miss, panel, tierX1, tierX2, tierX3, tierX4, whenDisplayFontReady, wrong } from "../ui-tokens";

// visual-direction.md's --pa-line: ink-dim at about 25%, for the divider and the progress line's track.
const hairline = "rgba(125, 132, 150, 0.25)";

export const hudSettings = {
  comboFrom: 5, // the combo number shows from this combo
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
  combo: { cx: number; cy: number; size: number; room: number }; // the numeral: its em size and the width it may fill
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
  const cluster = { x0: cx1 - h * 4.4, x1: cx1, y0, y1 };
  const numeral = { x0: cluster.x0 + pad * 0.6, x1: cluster.x0 + h * 1.75 };
  return {
    panel: { h },
    slots: { card: { x0: tag.x0, x1: tag.x1 } },
    tag,
    cluster,
    combo: { cx: (numeral.x0 + numeral.x1) / 2, cy: h / 2, size: h * 0.8, room: numeral.x1 - numeral.x0 },
    stack: { x: cluster.x0 + h * 1.95, rows: [h * 0.26, h * 0.5, h * 0.74], px: h * 0.19 },
    safeY: L * hudSettings.safeFraction,
  };
}

// The lowest point the HUD reaches: its band. The combo, its swell and its ghost stay inside it.
export function hudBottom(l: HudLayout): number {
  return l.panel.h;
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

export interface HudFonts {
  display: string; // Saira, condensed where its width axis has loaded
  data: string; // the monospace for data
}

// Draws at (x, y), shrunk to fit down to 60%, then cut with an ellipsis.
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, px: number, family: string, weight = ""): void {
  const set = (p: number) => (ctx.font = `${weight} ${Math.round(p)}px ${family}`);
  set(px);
  const w = ctx.measureText(text).width;
  if (w > maxW) set(Math.max(px * 0.6, (px * maxW) / w));
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
  ctx.fillText(t, x, y);
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Monospace caps with wide tracking, as visual-direction's data type.
function data(ctx: CanvasRenderingContext2D, fonts: HudFonts, px: number, weight = 500): void {
  ctx.font = `${weight} ${Math.round(px)}px ${fonts.data}`;
  ctx.letterSpacing = `${(px * 0.14).toFixed(1)}px`;
}

// wait: a wait-mode take isn't scored, so the band holds the song tag only (wait-hud draws its own count into it).
// shown: the score on screen (mid-roll); flash: the multiplier's tier-up flash, 0–1.
function drawHud(ctx: CanvasRenderingContext2D, f: Frame, s: HudState, tag: Tag | null, fonts: HudFonts, wait = false, shown = s.score, flash = 0): void {
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
    drawBrackets(ctx, x0, y0, x1 - x0, bh, { color: inkDim, arm: bh * 0.22 });
    const row = y0 + bh * 0.4;
    const px = h * 0.21;
    data(ctx, fonts, px);
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
    data(ctx, fonts, px);
    fitText(ctx, tag.title.toUpperCase(), x0 + inset, row, divX - px * 0.9 - (x0 + inset), px, fonts.data, "500");
    const ly = Math.round(y0 + bh * 0.76);
    const lw = x1 - x0 - inset * 2;
    ctx.fillStyle = hairline;
    ctx.fillRect(x0 + inset, ly, lw, 2);
    ctx.fillStyle = handR;
    ctx.fillRect(x0 + inset, ly, lw * Math.min(1, Math.max(0, tag.progress)), 2);
    ctx.letterSpacing = "0px";
  }

  if (wait) return;

  // Top right: the combo cluster. The numeral, then COMBO with the multiplier, ACC and SCORE.
  const c = l.cluster;
  drawBrackets(ctx, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, { color: inkDim, arm: (c.y1 - c.y0) * 0.22 });
  const still = reducedMotion();
  const m = s.milestone && s.milestone.count >= hudSettings.swellFrom && !still ? s.milestone : null;
  const t = m ? f.nowMs - m.atMs : Infinity;
  ctx.save();
  ctx.beginPath();
  ctx.rect(c.x0, 0, l.stack.x - c.x0, h);
  ctx.clip();
  if (m && t >= 0 && t < hudSettings.ghostMs) {
    const k = t / hudSettings.ghostMs;
    drawCombo(ctx, l, String(m.count), 1 + (hudSettings.ghostScale - 1) * k, hudSettings.ghostAlpha * (1 - k), tier.color, fonts.display);
  }
  const swell = t >= 0 && t < hudSettings.swellMs ? 1 + (hudSettings.swellScale - 1) * Math.sin((Math.PI * t) / hudSettings.swellMs) : 1;
  // Dim until it counts (comboFrom), then the primary color.
  drawCombo(ctx, l, String(s.combo), swell, 1, s.combo >= hudSettings.comboFrom ? handR : inkDim, fonts.display);
  ctx.restore();

  const { x, rows, px } = l.stack;
  const room = c.x1 - x - (c.y1 - c.y0) * 0.2;
  ctx.textAlign = "left";
  data(ctx, fonts, px, 600);
  ctx.fillStyle = handR;
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
    data(ctx, fonts, px);
    ctx.fillStyle = inkDim;
    ctx.fillText(label, x, y);
    const lw = ctx.measureText(`${label} `).width;
    ctx.fillStyle = ink;
    fitText(ctx, value, x + lw, y, room - lw, px, fonts.data, "500");
  };
  line("ACC", acc === null ? "—" : `${(acc * 100).toFixed(1)}%`, rows[1]);
  line("SCORE", shown.toLocaleString("en-US"), rows[2]);
  ctx.letterSpacing = "0px";
}

// The combo's numeral, condensed and upright, shrunk to its room if three digits would overflow it.
function drawCombo(ctx: CanvasRenderingContext2D, l: HudLayout, text: string, scale: number, alpha: number, color: string, display: string): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "0px";
  ctx.fontStretch = "condensed";
  let px = l.combo.size;
  ctx.font = `800 ${Math.round(px)}px ${display}`;
  const w = ctx.measureText(text.length < 3 ? "888" : text).width; // sized for three digits, so it doesn't jump at 100
  if (w > l.combo.room) px *= l.combo.room / w;
  ctx.font = `800 ${Math.round(px * scale)}px ${display}`;
  ctx.fillText(text, l.combo.cx, l.combo.cy);
  ctx.fontStretch = "normal";
  ctx.globalAlpha = 1;
}

// ---------- the plugin ----------

declare global {
  interface Window {
    __pianoArcadeHud?: HudState & { bar: number; bars: number }; // read by verify-hud.mjs
  }
}

// A face from a CSS variable (layout.tsx's next/font), once loaded; `fallback` until then.
function cssFace(name: string, fallback: string, set: (family: string) => void, ready: Promise<unknown>): void {
  if (typeof document === "undefined") return;
  void ready.then(() => {
    const family = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (family) set(`${family}, ${fallback}`);
  });
}

const monoFallback = "ui-monospace, SFMono-Regular, Menlo, monospace";

export function hud(): GamePlugin {
  let state = emptyHud();
  // The roll and the flash live here, not in HudState, so the score there stays exact at every event.
  let roll = { from: 0, to: 0, atMs: 0 };
  let tierUpAt: number | null = null;
  let title: string | null = null;
  let lines: BarLine[] = [];
  let endMs = 1;
  let wait = false;
  let bar = { n: 0, N: 0 };
  // Fallback faces until the real ones have loaded (or 1 s has passed), so the HUD never draws a half-loaded font.
  const fonts: HudFonts = { display: hudSettings.font, data: monoFallback };
  cssFace("--pa-font-display", hudSettings.font, (f) => (fonts.display = f), whenDisplayFontReady());
  const dataReady = () => {
    const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-data").trim();
    return family && document.fonts ? Promise.race([document.fonts.load(`500 1em ${family}`), new Promise((r) => setTimeout(r, 1000))]) : Promise.resolve();
  };
  if (typeof document !== "undefined") cssFace("--pa-font-data", monoFallback, (f) => (fonts.data = f), dataReady());
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
      } else if (state.score !== roll.to) {
        roll = { from: rollup(roll.from, roll.to, e.atMs - roll.atMs), to: state.score, atMs: e.atMs }; // from what's shown
      }
      if (tierFor(state.combo).mult > tierFor(before.combo).mult) tierUpAt = e.atMs;
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
      drawHud(ctx, frame, state, tag, fonts, wait, shown, flash);
    },
  };
}
