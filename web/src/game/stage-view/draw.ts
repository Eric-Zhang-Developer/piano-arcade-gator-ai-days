// /stage's frame: the hill, the notes on it, the hit effects, the combo and the end. Every size and time here is from
// specs/context/nostalgia-stage-findings.md (screen y = frame y × 1.5, see lane.ts) unless it says it's a choice, and
// the choices are in specs/decisions/stage-view-look.md. Colors are the Duo kit's, never the reference's.
// No shadowBlur or filter: the glows are gradients, so a 1080p frame stays cheap (findings: "the one trap").
import type { Chart, Judgment } from "../../contracts";
import { canvasFonts } from "../duo-tokens";
import { bg, flare, gold, good, handL, handR, ink, inkDim, line, miss, panel, primary } from "../ui-tokens";
import { edgeX, fieldWidth, notePoint, pitchU, stageLane } from "./lane";
import { onLane, type StageState } from "./state";

const COLORS: Record<Judgment, string> = { PERFECT: gold, GREAT: handR, GOOD: good, MISS: miss }; // the HUD's (core/highway.ts)
const S = 1.5; // frame y to screen y

export const stageFx = {
  pillarMs: 250, // fades linearly
  pillarW: 0.108, // of the width
  pillarH: 0.17 * S, // from the bar up
  burstBrightMs: 150, // the ring and spikes at full strength
  burstMs: 330, // the ring's tail
  ring: [0.064, 0.097] as const, // the ring's diameter, of the width, as it grows
  spikes: [0.146, 0.174 * S] as const, // the star's span: width, height
  textMs: 415,
  textY: 0.463 * S,
  textH: 0.022 * S, // cap height
  comboY: 0.133 * S, // the digits' centre
  comboH: 0.068 * S, // the digits' height
  labelY: 0.078 * S, // "combo" above them
  ghostMs: 500, // a milestone's ghost: grows to 1.65× as it fades
  ghostScale: 1.65,
  washMs: 1000, // after the last hit, peaking at 250 ms
  washPeakMs: 250,
  washY: [0.29 * S, 0.57 * S] as const,
  bannerAt: [1700, 1950, 4300, 5450] as const, // full combo: writes in, written, starts fading, gone (ms after it)
  bannerY: 0.26 * S,
  bannerW: 0.64, // x 0.17-0.81
  guidesU: [0.142, 0.351, 0.566, 0.775, 0.98], // the 10 guides' u at the bar's height, each side
};

export interface Lookup {
  chart: Chart;
  notes: Map<string, { u: number; hand: "L" | "R" }>;
}

// Per take: each note's place across the field, from the chart's own pitch range.
export function lookup(chart: Chart): Lookup {
  const pitches = chart.notes.map((n) => n.pitch);
  const [low, high] = [Math.min(...pitches), Math.max(...pitches)];
  return { chart, notes: new Map(chart.notes.map((n) => [n.id, { u: pitchU(n.pitch, low, high), hand: n.hand }])) };
}

const fade = (age: number, ms: number) => (age < 0 || age >= ms ? 0 : 1 - age / ms);

export function drawStage(ctx: CanvasRenderingContext2D, w: number, h: number, s: StageState, look: Lookup | null, now: number) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const live = !!s.chart && !s.ended;
  hill(ctx, w, h, live);
  if (s.chart && s.nowMs !== null && look) {
    beats(ctx, w, h, s.chart, s.nowMs);
    notes(ctx, w, h, s, look);
  }
  bar(ctx, w, h, live);
  if (look) hits(ctx, w, h, s, look, now);
  combo(ctx, w, h, s, now);
  if (s.fullCombo) finale(ctx, w, h, now - s.fullCombo.atMs);
}

// The hill's front face, crest to bar, and its guides: constant u, as the notes run (a choice; the reference's arch
// over the top isn't drawn).
function hill(ctx: CanvasRenderingContext2D, w: number, h: number, live: boolean) {
  const [top, bottom] = [stageLane.crestY, stageLane.barY];
  const steps = 24;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const y = top + ((bottom - top) * i) / steps;
    ctx.lineTo(edgeX(y, -1) * w, y * h);
  }
  for (let i = steps; i >= 0; i--) {
    const y = top + ((bottom - top) * i) / steps;
    ctx.lineTo(edgeX(y, 1) * w, y * h);
  }
  ctx.closePath();
  const face = ctx.createLinearGradient(0, top * h, 0, bottom * h);
  face.addColorStop(0, bg);
  face.addColorStop(1, panel);
  ctx.fillStyle = face;
  ctx.fill();

  // The crest catches the light: a glow behind it (the stage's one light, a choice) and a lit horizon along it, so the
  // hill reads in a still frame and notes visibly tip over it.
  const [cx, cy, crestHalf] = [w / 2, top * h, (fieldWidth(top / S) * w) / 2];
  const light = ctx.createRadialGradient(cx, cy, 0, cx, cy, crestHalf * 1.4);
  light.addColorStop(0, live ? "rgba(43, 155, 255, 0.16)" : "rgba(43, 155, 255, 0.08)");
  light.addColorStop(1, "rgba(43, 155, 255, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, cy + crestHalf * 1.4);
  const horizon = ctx.createLinearGradient(cx - crestHalf, 0, cx + crestHalf, 0);
  horizon.addColorStop(0, "rgba(226, 230, 240, 0)");
  horizon.addColorStop(0.5, live ? "rgba(226, 230, 240, 0.7)" : "rgba(226, 230, 240, 0.35)");
  horizon.addColorStop(1, "rgba(226, 230, 240, 0)");
  ctx.fillStyle = horizon;
  ctx.fillRect(cx - crestHalf, cy - Math.max(1, h / 720), 2 * crestHalf, Math.max(2, h / 360));

  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, h / 720);
  ctx.globalAlpha = live ? 1 : 0.6;
  for (const u of stageFx.guidesU)
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const y = top + ((bottom - top) * i) / steps;
        ctx.lineTo((0.5 + (side * u * fieldWidth(y / S)) / 2) * w, y * h);
      }
      ctx.stroke();
    }
  ctx.globalAlpha = 1;
}

// A line across the field at every beat, front face only, riding the same curve as the notes.
function beats(ctx: CanvasRenderingContext2D, w: number, h: number, chart: Chart, nowMs: number) {
  const mpb = 60000 / chart.bpm;
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, h / 720);
  for (let b = Math.ceil(nowMs / mpb); b * mpb - nowMs <= stageLane.crestMs; b++) {
    const p = notePoint(1, b * mpb - nowMs);
    if (!p) continue;
    ctx.beginPath();
    ctx.moveTo((1 - p.x) * w, p.y * h);
    ctx.lineTo(p.x * w, p.y * h);
    ctx.stroke();
  }
}

// A note: a bar with pointed ends (zero radius, the kit's), in its hand's color, dim on the back slope.
function notes(ctx: CanvasRenderingContext2D, w: number, h: number, s: StageState, look: Lookup) {
  const due = onLane(s, stageLane.approachMs);
  for (let i = due.length - 1; i >= 0; i--) {
    const n = due[i]; // the far ones first, so the near ones draw over them
    const at = look.notes.get(n.id);
    const p = at && notePoint(at.u, (1 - n.t) * stageLane.approachMs);
    if (!p) continue;
    const [cx, cy, hw, hh] = [p.x * w, p.y * h, (p.w * w) / 2, (p.h * h) / 2];
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = at.hand === "L" ? handL : handR;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy);
    ctx.lineTo(cx - hw + hh, cy - hh);
    ctx.lineTo(cx + hw - hh, cy - hh);
    ctx.lineTo(cx + hw, cy);
    ctx.lineTo(cx + hw - hh, cy + hh);
    ctx.lineTo(cx - hw + hh, cy + hh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = flare; // the top edge catches the light
    ctx.globalAlpha = p.alpha * 0.55;
    ctx.fillRect(cx - hw + hh, cy - hh, 2 * (hw - hh), Math.max(1, hh * 0.35));
  }
  ctx.globalAlpha = 1;
}

// The judgment bar: a hairline of light with a glow band (0.542-0.567 of the frame) drawn as a gradient.
function bar(ctx: CanvasRenderingContext2D, w: number, h: number, live: boolean) {
  const [y, band] = [stageLane.barY * h, ((0.567 - 0.542) * S * h) / 2];
  const glow = ctx.createLinearGradient(0, y - band, 0, y + band);
  glow.addColorStop(0, "rgba(43, 155, 255, 0)");
  glow.addColorStop(0.5, live ? "rgba(43, 155, 255, 0.45)" : "rgba(43, 155, 255, 0.18)");
  glow.addColorStop(1, "rgba(43, 155, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0.005 * w, y - band, 0.99 * w, 2 * band);
  ctx.fillStyle = live ? flare : inkDim;
  ctx.fillRect(0.005 * w, y - Math.max(1, h / 540), 0.99 * w, 2 * Math.max(1, h / 540));
}

// Each hit, at its note's place on the bar: a pillar, a starburst and its judgment's name. A MISS gets the name only.
function hits(ctx: CanvasRenderingContext2D, w: number, h: number, s: StageState, look: Lookup, now: number) {
  const barY = stageLane.barY * h;
  const fieldW = fieldWidth(0.555);
  for (const hit of s.hits) {
    const age = now - hit.atMs;
    const at = look.notes.get(hit.noteId);
    if (!at || age > stageFx.textMs) continue;
    const x = (0.5 + (at.u * fieldW) / 2) * w;
    const color = COLORS[hit.judgment];
    if (hit.judgment !== "MISS") {
      ctx.globalCompositeOperation = "lighter";
      const pa = fade(age, stageFx.pillarMs);
      if (pa > 0) {
        const [pw, ph] = [stageFx.pillarW * w, stageFx.pillarH * h];
        const g = ctx.createLinearGradient(0, barY, 0, barY - ph);
        g.addColorStop(0, color);
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.globalAlpha = pa;
        ctx.fillStyle = g;
        ctx.fillRect(x - pw / 2, barY - ph, pw, ph);
        const core = ctx.createLinearGradient(0, barY, 0, barY - ph);
        core.addColorStop(0, flare);
        core.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = core; // a white core a third as wide: from across a room the pillar is light, not a tint
        ctx.fillRect(x - pw / 6, barY - ph, pw / 3, ph);
      }
      const ba = age < stageFx.burstBrightMs ? 1 : fade(age - stageFx.burstBrightMs, stageFx.burstMs - stageFx.burstBrightMs);
      if (ba > 0) {
        const k = Math.min(1, age / stageFx.burstBrightMs);
        const r = ((stageFx.ring[0] + (stageFx.ring[1] - stageFx.ring[0]) * k) * w) / 2;
        ctx.globalAlpha = ba;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, h / 240);
        ctx.beginPath();
        ctx.arc(x, barY, r, 0, Math.PI * 2);
        ctx.stroke();
        if (age < stageFx.burstBrightMs) {
          const [sx, sy] = [(stageFx.spikes[0] * w * (0.6 + 0.4 * k)) / 2, (stageFx.spikes[1] * h * (0.6 + 0.4 * k)) / 2];
          const t = r * 0.18; // the spikes' waist
          ctx.fillStyle = flare;
          ctx.beginPath();
          ctx.moveTo(x, barY - sy);
          ctx.lineTo(x + t, barY - t);
          ctx.lineTo(x + sx, barY);
          ctx.lineTo(x + t, barY + t);
          ctx.lineTo(x, barY + sy);
          ctx.lineTo(x - t, barY + t);
          ctx.lineTo(x - sx, barY);
          ctx.lineTo(x - t, barY - t);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // The name holds, then goes in its last 100 ms (on to 0:40.23, gone at 0:40.33).
    ctx.globalAlpha = Math.min(1, (stageFx.textMs - age) / 100);
    ctx.fillStyle = color;
    ctx.font = canvasFonts.display(Math.round((stageFx.textH * h) / 0.7));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(hit.judgment, x, stageFx.textY * h);
  }
  ctx.globalAlpha = 1;
}

// The combo, top centre, and a milestone's ghost swelling out of it.
function combo(ctx: CanvasRenderingContext2D, w: number, h: number, s: StageState, now: number) {
  if (!s.chart || s.ended) return;
  if (s.fullCombo && now - s.fullCombo.atMs >= stageFx.bannerAt[0]) return; // the field gives way to the banner
  const px = Math.round((stageFx.comboH * h) / 0.72);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (s.milestone) {
    const age = now - s.milestone.atMs;
    const a = fade(age, stageFx.ghostMs);
    if (a > 0) {
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = ink;
      ctx.font = canvasFonts.numeral(Math.round(px * (1 + (stageFx.ghostScale - 1) * (age / stageFx.ghostMs))));
      ctx.fillText(String(s.milestone.count), w / 2, stageFx.comboY * h);
      ctx.globalAlpha = 1;
    }
  }
  if (s.combo < 1) return;
  ctx.fillStyle = ink;
  ctx.font = canvasFonts.numeral(px);
  ctx.fillText(String(s.combo), w / 2, stageFx.comboY * h);
  ctx.fillStyle = inkDim;
  ctx.font = canvasFonts.data(Math.round(h / 36));
  ctx.fillText("COMBO", w / 2, stageFx.labelY * h);
}

// A full combo: a wash of light over the lower field, then the banner writes in, holds and fades.
function finale(ctx: CanvasRenderingContext2D, w: number, h: number, age: number) {
  if (age < stageFx.washMs) {
    const a = age < stageFx.washPeakMs ? age / stageFx.washPeakMs : 1 - (age - stageFx.washPeakMs) / (stageFx.washMs - stageFx.washPeakMs);
    const [y0, y1] = [stageFx.washY[0] * h, stageFx.washY[1] * h];
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(43, 155, 255, 0)");
    g.addColorStop(0.75, "rgba(226, 230, 240, 0.9)");
    g.addColorStop(1, "rgba(43, 155, 255, 0.5)");
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, w, y1 - y0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  const [inAt, written, outAt, gone] = stageFx.bannerAt;
  if (age < inAt || age >= gone) return;
  const reveal = Math.min(1, (age - inAt) / (written - inAt)); // writes in left to right
  const a = age < outAt ? 1 : 1 - (age - outAt) / (gone - outAt);
  const text = "FULL COMBO";
  let px = Math.round(h / 6);
  ctx.font = canvasFonts.display(px);
  px = Math.round((px * stageFx.bannerW * w) / ctx.measureText(text).width);
  ctx.font = canvasFonts.display(px);
  const y = stageFx.bannerY * h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(((1 - stageFx.bannerW) / 2) * w, y - px, stageFx.bannerW * w * reveal, 2 * px);
  ctx.clip();
  ctx.globalAlpha = a;
  ctx.fillStyle = gold;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, y);
  ctx.restore();
  ctx.fillStyle = primary;
  ctx.globalAlpha = a;
  ctx.fillRect(((1 - stageFx.bannerW) / 2) * w, y + px * 0.42, stageFx.bannerW * w * reveal, Math.max(2, h / 270));
  ctx.globalAlpha = 1;
}
