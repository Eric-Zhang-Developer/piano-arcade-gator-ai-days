// Arcade HUD: song card, live counters, the combo, score and multiplier in the band up top (specs: hud, combo-hud).
// Driven only by GameEvents; reduceHud and hudLayout are pure so tests can pin them.
import type { Chart, Frame, GameEvent, GamePlugin } from "../../contracts";
import { isWaitMode } from "../wait-mode";
import { bg, gold, good, miss, panel, tierX1, tierX2, tierX3, tierX4, whenDisplayFontReady, wrong } from "../ui-tokens";

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
  // PERFECT, GREAT and MISS as core's highway; GOOD and WRONG per judging-tiers' defaults (calm blue, strong red).
  // GREAT has no token of its own (visual-direction names none), so it keeps its literal value.
  judgmentColors: { PERFECT: gold, GREAT: "#5ef2c4", GOOD: good, MISS: miss, wrong },
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
  font: "system-ui, sans-serif", // labels; numbers and the title use the display face once it has loaded
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

export interface HudLayout {
  panel: { h: number };
  // Left to right: the song card, PERFECT/GREAT/GOOD, the combo, MISS/WRONG, then score and multiplier up to
  // beat-track's gutter. The combo sits between what builds it and what breaks it (spec: combo-hud).
  slots: { card: HudSlot; hits: HudSlot; combo: HudSlot; breaks: HudSlot; score: HudSlot };
  combo: { cx: number; cy: number; size: number; labelY: number }; // digits' em size; inside the band
  safeY: number; // nothing drawn below this
}

export function hudLayout(width: number, judgmentLineY: number): HudLayout {
  const L = judgmentLineY;
  const h = Math.max(44, Math.min(84, L * 0.11));
  const at = (f: number) => width * f;
  const slots = {
    card: { x0: 0, x1: at(0.28) },
    hits: { x0: at(0.28), x1: at(0.44) },
    combo: { x0: at(0.44), x1: at(0.56) },
    breaks: { x0: at(0.56), x1: at(0.66) },
    score: { x0: at(0.66), x1: width - hudSettings.statusGutterPx },
  };
  // The band's biggest number: bigger than the multiplier's h × 0.5.
  return { panel: { h }, slots, combo: { cx: width / 2, cy: h * 0.4, size: h * 0.62, labelY: h * 0.83 }, safeY: L * hudSettings.safeFraction };
}

// The lowest point the HUD reaches: its band. The combo, its swell and its ghost stay inside it.
export function hudBottom(l: HudLayout): number {
  return l.panel.h;
}

// ---------- drawing ----------

type Card = { title: string; line2: string };

// Draws at (0, 0), shrunk to fit down to 60%, then cut with an ellipsis.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight = "", family = hudSettings.font): void {
  const set = (p: number) => (ctx.font = `${weight} ${Math.round(p)}px ${family}`);
  set(px);
  const w = ctx.measureText(text).width;
  if (w > maxW) set(Math.max(px * 0.6, (px * maxW) / w));
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
  ctx.fillText(t, 0, 0);
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// wait: a wait-mode take isn't scored, so the band holds the song card only (wait-hud draws its own count into it).
// shown: the score on screen (mid-roll); flash: the badge's tier-up flash, 0–1.
function drawHud(ctx: CanvasRenderingContext2D, f: Frame, s: HudState, card: Card | null, display: string, wait = false, shown = s.score, flash = 0): void {
  const l = hudLayout(f.width, f.judgmentLineY);
  const { h } = l.panel;
  const { slots } = l;
  const pad = Math.max(10, h * 0.25);
  const tier = wait ? hudSettings.tiers[0] : tierFor(s.combo);

  // The band, opaque under the 72%-opaque panel: notes and labels below draw from y = 0 (#243).
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, f.width, h);
  ctx.fillStyle = hudSettings.panelBg;
  ctx.fillRect(0, 0, f.width, h);
  ctx.fillStyle = tier.color;
  ctx.fillRect(0, h - 2, f.width, 2);
  ctx.textBaseline = "middle";

  // Left: the song card.
  if (card) {
    const cardW = slots.card.x1 - slots.card.x0;
    ctx.textAlign = "left";
    ctx.save();
    ctx.translate(pad, h * 0.36);
    ctx.fillStyle = "#ffffff";
    fitText(ctx, card.title, cardW - pad * 1.5, h * 0.3, "italic 800", display);
    ctx.translate(0, h * 0.34);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    fitText(ctx, card.line2, cardW - pad * 1.5, h * 0.2);
    ctx.restore();
  }

  if (wait) return;

  // The counters: what builds the combo left of it, what breaks it right of it.
  const counters = (slot: HudSlot, keys: [string, keyof typeof hudSettings.judgmentColors][]) => {
    const cw = (slot.x1 - slot.x0) / keys.length;
    ctx.textAlign = "center";
    keys.forEach(([label, key], i) => {
      const x = slot.x0 + cw * (i + 0.5);
      ctx.fillStyle = hudSettings.judgmentColors[key];
      ctx.font = `italic 800 ${Math.round(Math.min(h * 0.34, cw * 0.42))}px ${display}`;
      ctx.fillText(String(s[key]), x, h * 0.4);
      ctx.font = `600 ${Math.round(Math.min(h * 0.16, cw * 0.15))}px ${hudSettings.font}`;
      ctx.fillText(label, x, h * 0.76);
    });
  };
  counters(slots.hits, [
    ["PERFECT", "PERFECT"],
    ["GREAT", "GREAT"],
    ["GOOD", "GOOD"],
  ]);
  counters(slots.breaks, [
    ["MISS", "MISS"],
    ["WRONG", "wrong"],
  ]);

  // Center: the combo, from comboFrom; a milestone from swellFrom swells it and fades a ghost in the tier color.
  if (s.combo >= hudSettings.comboFrom) {
    const still = reducedMotion();
    const m = s.milestone && s.milestone.count >= hudSettings.swellFrom && !still ? s.milestone : null;
    const t = m ? f.nowMs - m.atMs : Infinity;
    ctx.save();
    ctx.beginPath();
    ctx.rect(slots.combo.x0, 0, slots.combo.x1 - slots.combo.x0, h);
    ctx.clip();
    if (m && t >= 0 && t < hudSettings.ghostMs) {
      const k = t / hudSettings.ghostMs;
      drawCombo(ctx, l, String(m.count), 1 + (hudSettings.ghostScale - 1) * k, hudSettings.ghostAlpha * (1 - k), tier.color, display);
    }
    const swell = t >= 0 && t < hudSettings.swellMs ? 1 + (hudSettings.swellScale - 1) * Math.sin((Math.PI * t) / hudSettings.swellMs) : 1;
    drawCombo(ctx, l, String(s.combo), swell, 1, "#ffffff", display);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 ${Math.round(h * 0.15)}px ${hudSettings.font}`;
    ctx.textAlign = "center";
    ctx.letterSpacing = `${Math.round(h * 0.03)}px`;
    ctx.fillText("COMBO", l.combo.cx, l.combo.labelY);
    ctx.letterSpacing = "0px";
  }

  // Right: score, then the multiplier and its pips.
  const right = f.width - pad - hudSettings.statusGutterPx;
  const badge = Math.round(h * 0.5);
  ctx.textAlign = "right";
  ctx.fillStyle = tier.color;
  ctx.font = `italic 900 ${badge}px ${display}`;
  const badgeW = ctx.measureText(`x${tier.mult}`).width;
  ctx.save();
  if (flash > 0) {
    // A tier-up: the badge glows in its new color and settles from a little larger, inside the band.
    ctx.beginPath();
    ctx.rect(0, 0, f.width, h);
    ctx.clip();
    ctx.shadowColor = tier.color;
    ctx.shadowBlur = h * 0.5 * flash;
    const k = 1 + (hudSettings.flashScale - 1) * flash;
    ctx.translate(right - badgeW / 2, h * 0.4);
    ctx.scale(k, k);
    ctx.translate(-(right - badgeW / 2), -h * 0.4);
  }
  ctx.fillText(`x${tier.mult}`, right, h * 0.4);
  ctx.restore();
  const { filled, of } = tierProgress(s.combo);
  const pip = Math.max(2, h * 0.045);
  for (let i = 0; i < of; i++) {
    ctx.beginPath();
    ctx.arc(right - badgeW + (badgeW / of) * (i + 0.5), h * 0.8, pip, 0, Math.PI * 2);
    ctx.globalAlpha = i < filled ? 1 : 0.25;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const scoreRight = right - badgeW - pad;
  ctx.fillStyle = "#ffffff";
  const score = shown.toLocaleString("en-US");
  let px = h * 0.42;
  ctx.font = `italic 800 ${Math.round(px)}px ${display}`;
  const room = scoreRight - slots.score.x0 - pad;
  const w = ctx.measureText(score).width;
  if (w > room) ctx.font = `italic 800 ${Math.round((px *= room / w))}px ${display}`;
  ctx.fillText(score, scoreRight, h * 0.42);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(h * 0.16)}px ${hudSettings.font}`;
  ctx.fillText("SCORE", scoreRight, h * 0.8);
}

// The combo's number, shrunk to its slot if three digits would overflow it.
function drawCombo(ctx: CanvasRenderingContext2D, l: HudLayout, text: string, scale: number, alpha: number, color: string, display: string): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let px = l.combo.size;
  ctx.font = `italic 900 ${Math.round(px)}px ${display}`;
  const room = (l.slots.combo.x1 - l.slots.combo.x0) * 0.92;
  const w = ctx.measureText(text.length < 3 ? "888" : text).width; // sized for three digits, so it doesn't jump at 100
  if (w > room) px *= room / w;
  ctx.font = `italic 900 ${Math.round(px * scale)}px ${display}`;
  ctx.fillText(text, l.combo.cx, l.combo.cy);
  ctx.globalAlpha = 1;
}

// ---------- the plugin ----------

declare global {
  interface Window {
    __pianoArcadeHud?: HudState; // read by verify-hud.mjs
  }
}

export function hud(): GamePlugin {
  let state = emptyHud();
  // The roll and the flash live here, not in HudState, so the score there stays exact at every event.
  let roll = { from: 0, to: 0, atMs: 0 };
  let tierUpAt: number | null = null;
  let card: Card | null = null;
  let wait = false;
  // Body face until the display face has loaded (or 1 s has passed), so the HUD never draws a half-loaded font.
  let display = hudSettings.font;
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) display = `${family}, ${hudSettings.font}`;
    });
  return {
    id: "hud",
    transformChart(chart: Chart, params: URLSearchParams) {
      wait = isWaitMode(params);
      card = { title: chart.title, line2: [chart.composer, chart.catalog].filter(Boolean).join(" · ") };
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
      if (typeof window !== "undefined") window.__pianoArcadeHud = state;
    },
    draw(ctx, frame) {
      const still = reducedMotion();
      const shown = still ? state.score : rollup(roll.from, roll.to, frame.nowMs - roll.atMs);
      const flash = still || tierUpAt === null ? 0 : tierFlash(frame.nowMs - tierUpAt);
      drawHud(ctx, frame, state, card, display, wait, shown, flash);
    },
  };
}
