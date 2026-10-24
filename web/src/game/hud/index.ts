// Arcade HUD: song card, live counters, score and multiplier up top, and a giant translucent combo (spec: hud).
// Driven only by GameEvents; reduceHud and hudLayout are pure so tests can pin them.
import type { Chart, Frame, GameEvent, GamePlugin } from "../../contracts";

export const hudSettings = {
  comboFrom: 5, // the combo number shows from this combo
  points: { PERFECT: 100, GREAT: 50, GOOD: 25 },
  // Guitar Hero 3's tier colors: white, orange, green, purple (decision hud-look).
  tiers: [
    { from: 0, mult: 1, color: "#e8e8ec" },
    { from: 10, mult: 2, color: "#ff9f43" },
    { from: 20, mult: 3, color: "#8ee05e" },
    { from: 30, mult: 4, color: "#c47cff" },
  ],
  // PERFECT, GREAT and MISS as core's highway; GOOD and WRONG per judging-tiers' defaults (calm blue, strong red).
  judgmentColors: { PERFECT: "#ffe27a", GREAT: "#5ef2c4", GOOD: "#7cb7ff", MISS: "#c98a9a", wrong: "#ff4d5e" },
  statusGutterPx: 120, // beat-track's status line ("Beat: piano", 13px) sits in the top-right corner
  safeFraction: 0.6, // nothing below this fraction of the judgment line: the lowest 40% is where notes land
  panelBg: "rgba(12,12,16,0.72)",
  comboAlpha: 0.2, // drawn over the notes, so faint enough that they read through (decision hud-look)
  swellMs: 250,
  swellScale: 1.25,
  ghostMs: 1000,
  ghostScale: 1.6,
  ghostAlpha: 0.3,
  font: "system-ui, sans-serif",
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

// ---------- layout (CSS px) ----------

export interface HudLayout {
  panel: { h: number };
  combo: { cx: number; cy: number; size: number }; // digits' em size; they reach about ±size/2 around cy
  safeY: number; // nothing drawn below this
}

export function hudLayout(width: number, judgmentLineY: number): HudLayout {
  const L = judgmentLineY;
  const h = Math.max(44, Math.min(84, L * 0.11));
  const size = Math.min(L * 0.26, width * 0.22);
  return { panel: { h }, combo: { cx: width / 2, cy: h + size * 0.62, size }, safeY: L * hudSettings.safeFraction };
}

// The lowest point anything reaches: the ghost at full scale, and the COMBO label under the number.
export function hudBottom(l: HudLayout): number {
  const { cy, size } = l.combo;
  return Math.max(l.panel.h, cy + (size * hudSettings.ghostScale) / 2, cy + size * 0.5 + size * 0.22);
}

// ---------- drawing ----------

type Card = { title: string; line2: string };

// Draws at (0, 0), shrunk to fit down to 60%, then cut with an ellipsis.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight = ""): void {
  const set = (p: number) => (ctx.font = `${weight} ${Math.round(p)}px ${hudSettings.font}`);
  set(px);
  const w = ctx.measureText(text).width;
  if (w > maxW) set(Math.max(px * 0.6, (px * maxW) / w));
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
  ctx.fillText(t, 0, 0);
}

function drawHud(ctx: CanvasRenderingContext2D, f: Frame, s: HudState, card: Card | null): void {
  const l = hudLayout(f.width, f.judgmentLineY);
  const { h } = l.panel;
  const pad = Math.max(10, h * 0.25);
  const tier = tierFor(s.combo);

  // The giant combo first, so the panel draws over its top edge if they ever meet.
  if (s.milestone) {
    const t = f.nowMs - s.milestone.atMs;
    if (t >= 0 && t < hudSettings.ghostMs) {
      const k = t / hudSettings.ghostMs;
      drawCombo(ctx, l, String(s.milestone.count), 1 + (hudSettings.ghostScale - 1) * k, hudSettings.ghostAlpha * (1 - k), tier.color);
    }
  }
  if (s.combo >= hudSettings.comboFrom) {
    const t = s.milestone ? f.nowMs - s.milestone.atMs : Infinity;
    const swell = t >= 0 && t < hudSettings.swellMs ? 1 + (hudSettings.swellScale - 1) * Math.sin((Math.PI * t) / hudSettings.swellMs) : 1;
    drawCombo(ctx, l, String(s.combo), swell, hudSettings.comboAlpha, "#ffffff");
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${Math.round(l.combo.size * 0.16)}px ${hudSettings.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${Math.round(l.combo.size * 0.04)}px`;
    ctx.fillText("COMBO", l.combo.cx, l.combo.cy + l.combo.size * 0.6);
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 1;
  }

  // Top panel.
  ctx.fillStyle = hudSettings.panelBg;
  ctx.fillRect(0, 0, f.width, h);
  ctx.fillStyle = tier.color;
  ctx.fillRect(0, h - 2, f.width, 2);
  ctx.textBaseline = "middle";

  // Left: the song card.
  const cardW = f.width * 0.3;
  if (card) {
    ctx.textAlign = "left";
    ctx.save();
    ctx.translate(pad, h * 0.36);
    ctx.fillStyle = "#ffffff";
    fitText(ctx, card.title, cardW - pad * 1.5, h * 0.3, "700");
    ctx.translate(0, h * 0.34);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    fitText(ctx, card.line2, cardW - pad * 1.5, h * 0.2);
    ctx.restore();
  }

  // Middle: the counters.
  const counters: [string, keyof typeof hudSettings.judgmentColors][] = [
    ["PERFECT", "PERFECT"],
    ["GREAT", "GREAT"],
    ["GOOD", "GOOD"],
    ["MISS", "MISS"],
    ["WRONG", "wrong"],
  ];
  const cw = (f.width * 0.34) / counters.length;
  ctx.textAlign = "center";
  counters.forEach(([label, key], i) => {
    const x = cardW + cw * (i + 0.5);
    ctx.fillStyle = hudSettings.judgmentColors[key];
    ctx.font = `800 ${Math.round(h * 0.34)}px ${hudSettings.font}`;
    ctx.fillText(String(s[key]), x, h * 0.4);
    ctx.font = `600 ${Math.round(Math.min(h * 0.16, cw * 0.15))}px ${hudSettings.font}`;
    ctx.fillText(label, x, h * 0.76);
  });

  // Right: score, then the multiplier and its pips.
  const right = f.width - pad - hudSettings.statusGutterPx;
  const badge = Math.round(h * 0.5);
  ctx.textAlign = "right";
  ctx.fillStyle = tier.color;
  ctx.font = `900 ${badge}px ${hudSettings.font}`;
  ctx.fillText(`x${tier.mult}`, right, h * 0.4);
  const badgeW = ctx.measureText(`x${tier.mult}`).width;
  const { filled, of } = tierProgress(s.combo);
  const pip = Math.max(2, h * 0.045);
  for (let i = 0; i < of; i++) {
    ctx.beginPath();
    ctx.arc(right - badgeW + (badgeW / of) * (i + 0.5), h * 0.8, pip, 0, Math.PI * 2);
    ctx.globalAlpha = i < filled ? 1 : 0.25;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(h * 0.42)}px ${hudSettings.font}`;
  ctx.fillText(s.score.toLocaleString("en-US"), right - badgeW - pad, h * 0.42);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `600 ${Math.round(h * 0.16)}px ${hudSettings.font}`;
  ctx.fillText("SCORE", right - badgeW - pad, h * 0.8);
}

function drawCombo(ctx: CanvasRenderingContext2D, l: HudLayout, text: string, scale: number, alpha: number, color: string): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.round(l.combo.size * scale)}px ${hudSettings.font}`;
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
  let card: Card | null = null;
  return {
    id: "hud",
    transformChart(chart: Chart) {
      card = { title: chart.title, line2: [chart.composer, chart.catalog].filter(Boolean).join(" · ") };
      return chart;
    },
    onEvent(e) {
      state = reduceHud(state, e);
      if (typeof window !== "undefined") window.__pianoArcadeHud = state;
    },
    draw(ctx, frame) {
      drawHud(ctx, frame, state, card);
    },
  };
}
