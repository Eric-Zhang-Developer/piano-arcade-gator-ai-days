// Count-in (spec: count-in, #1006): the 8 beats before the first note. The listen half fills a 4-cell ruler over the
// hit line; the count half shows 4 3 2 1 while the ruler drains; the hit line pulses on every beat and burns white
// for one frame on beat 0. No title slate: the HUD's song card already says it there (decision count-in-slate). Every beat time is beat-track's count-in click time (beatHits), on the same chart clock.
import type { Chart, Frame, GamePlugin } from "../../contracts";
import { beatHits } from "../beat";
import { msPerBeat, settings as core } from "../core/settings";
import { canvasFonts } from "../duo-tokens/canvas";
import { hitLinePath } from "../hit-line";
import { bg, ink, inkDim, primary, whenDisplayFontReady } from "../ui-tokens";

export const countInSettings = {
  frameMs: 1000 / 60, // beat 0's white-hot frame lasts one 60 fps frame
  fadeInMs: 40, // a numeral's fade-in on its beat
  settleMs: 120, // its scale settles from settleFrom to 1 over this
  settleFrom: 1.04,
  fadeOutFrom: 0.7, // and it fades out over the beat's last 30%
  tickFillMs: 90, // a tick's fill wipes up over this (decision count-in-look)
  pulseDecay: 0.6, // the hit line's pulse is gone this far into its beat
  pulsePeak: { accent: 1, plain: 0.55 },
};

export interface CountInState {
  beat: number | null; // 1..8 during the count-in, else null
  ticks: number[]; // the ruler's 4 ticks, each 0..1 filled
  accents: boolean[]; // which ticks sit on an accented beat (beat-track's rule: each bar's beat 1)
  numeral: { text: string; alpha: number; scale: number; accent: boolean } | null;
  pulse: number; // 0..1, the hit line's extra brightness
  accent: boolean; // the current beat is accented
  hot: boolean; // beat 0's one white-hot frame
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// The count-in's beats as beat-track clicks them: the side-stick hits before chart time 0.
export function countInBeats(chart: Pick<Chart, "bpm" | "beatsPerBar" | "notes">, beats = core.countInBeats) {
  return beatHits(chart as Chart, -beats * msPerBeat(chart.bpm), 0, beats).map((h) => ({ atMs: h.atMs, accent: h.accent }));
}

const NONE: CountInState = { beat: null, ticks: [0, 0, 0, 0], accents: [false, false, false, false], numeral: null, pulse: 0, accent: false, hot: false };

// The count-in at chart time nowMs: a pure function of the clock, so a pause or a retry can never leave it half-drawn.
export function countInAt(beats: { atMs: number; accent: boolean }[], nowMs: number, reduced = false): CountInState {
  const s = countInSettings;
  if (!beats.length) return NONE;
  if (nowMs >= 0) return { ...NONE, hot: nowMs < s.frameMs };
  let i = -1;
  while (i + 1 < beats.length && beats[i + 1].atMs <= nowMs) i++;
  if (i < 0) return NONE;
  const half = Math.floor(beats.length / 2);
  const mpb = (beats[1]?.atMs ?? 0) - beats[0].atMs || -beats[0].atMs;
  const t = nowMs - beats[i].atMs;
  const accent = beats[i].accent;
  const fill = reduced ? 1 : easeOutCubic(clamp01(t / s.tickFillMs));
  const accents = Array.from({ length: half }, (_, k) => beats[k].accent);
  // Listen half: tick k fills on beat k. Count half: the ruler drains, one tick per beat, as the numerals count down.
  const ticks = Array.from({ length: half }, (_, k) => {
    if (i < half) return k < i ? 1 : k === i ? fill : 0;
    const left = beats.length - i; // as many ticks stand as the numeral says: 4, 3, 2, 1; the next one drains now
    return k < left ? 1 : k === left ? 1 - fill : 0;
  });
  let numeral: CountInState["numeral"] = null;
  if (i >= half) {
    const text = String(beats.length - i);
    if (reduced) numeral = { text, alpha: 1, scale: 1, accent };
    else {
      const out = s.fadeOutFrom * mpb;
      const alpha = Math.min(clamp01(t / s.fadeInMs), t > out ? clamp01((mpb - t) / (mpb - out)) : 1);
      const scale = s.settleFrom - (s.settleFrom - 1) * easeOutCubic(clamp01(t / s.settleMs));
      numeral = { text, alpha, scale, accent };
    }
  }
  const peak = accent ? s.pulsePeak.accent : s.pulsePeak.plain;
  const pulse = reduced ? peak : peak * (1 - clamp01(t / (s.pulseDecay * mpb))) ** 1.5;
  return { beat: i + 1, ticks, accents, numeral, pulse, accent, hot: false };
}

// Where it draws, from the frame: the ruler just above the hit line (under hand-colors' L/R legend), the numerals
// lower than the old digit, so the eye is already near the line when the first note lands (decision count-in-look).
export function countInLayout(f: Pick<Frame, "width" | "judgmentLineY">) {
  const L = f.judgmentLineY;
  const w = Math.min(f.width * 0.3, 520);
  const cellH = Math.max(8, Math.round(L * 0.016));
  return {
    ruler: { x: (f.width - w) / 2, bottom: L - 12, w, gap: Math.max(6, Math.round(w * 0.02)), cellH },
    numeral: { x: f.width / 2, y: L * 0.6, px: Math.round(L * 0.34) },
  };
}

function drawCountIn(ctx: CanvasRenderingContext2D, f: Frame, c: CountInState, reduced: boolean) {
  const L = countInLayout(f);
  ctx.save();
  if (c.beat !== null) {
    // The ruler: 4 cells, one per beat of a half. An accented beat's cell stands taller; a filled cell is solid
    // primary, wiping in from the left; an empty one is a hairline frame.
    const { x, bottom, w, gap, cellH } = L.ruler;
    const cw = (w - gap * (c.ticks.length - 1)) / c.ticks.length;
    c.ticks.forEach((fill, k) => {
      const h = c.accents[k] ? cellH * 1.75 : cellH;
      const cx = x + k * (cw + gap);
      ctx.strokeStyle = inkDim;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(cx) + 0.5, Math.round(bottom - h) + 0.5, Math.round(cw) - 1, Math.round(h) - 1);
      ctx.globalAlpha = 1;
      if (fill > 0) {
        ctx.fillStyle = primary;
        ctx.fillRect(Math.round(cx), Math.round(bottom - h), Math.round(cw * fill), Math.round(h));
      }
    });
  }
  if (c.numeral && c.numeral.alpha > 0) {
    // The numeral, knocked out of the notes behind it by a ground-colored edge, so a falling note never cuts it.
    const { x, y, px } = L.numeral;
    ctx.save();
    ctx.globalAlpha = c.numeral.alpha;
    ctx.translate(x, y);
    ctx.scale(c.numeral.scale, c.numeral.scale);
    ctx.font = canvasFonts.numeral(px);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, px * 0.035);
    ctx.strokeStyle = bg;
    ctx.strokeText(c.numeral.text, 0, 0);
    ctx.fillStyle = c.numeral.accent ? primary : ink;
    ctx.fillText(c.numeral.text, 0, 0);
    ctx.restore();
  }
  if (c.pulse > 0 || c.hot) {
    // Over the hit line, on its own path: brighter on each beat, primary on the accents; white-hot on beat 0.
    const path = hitLinePath(f.width, f.nowMs, reduced);
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p.x, f.judgmentLineY + p.dy) : ctx.moveTo(p.x, f.judgmentLineY + p.dy)));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (c.hot) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 6;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = reduced ? 0 : 40; // reduced motion: the white without the bloom
      ctx.stroke();
    } else {
      ctx.globalAlpha = reduced ? c.pulse * 0.6 : c.pulse;
      ctx.strokeStyle = c.accent ? primary : ink;
      ctx.lineWidth = reduced ? 3 : 3 + 3 * c.pulse;
      ctx.shadowColor = c.accent ? primary : ink;
      ctx.shadowBlur = reduced ? 0 : 26 * c.pulse;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

export interface CountInFrame {
  perfMs: number;
  nowMs: number;
  beat: number | null;
  numeral: string | null;
  alpha: number; // the numeral's
  scale: number;
  ticks: number; // filled ticks, whole ones
  pulse: number;
  hot: boolean;
}

export function countIn(): GamePlugin {
  let chart: Chart | null = null;
  let beats: { atMs: number; accent: boolean }[] = [];
  return {
    id: "count-in",
    transformChart(c) {
      chart = c;
      beats = countInBeats(c);
      if (typeof window !== "undefined") window.__pianoArcadeCountIn = { beats: beats.map((b) => b.atMs), frames: [] };
      void whenDisplayFontReady(); // canvasFonts reads the family; the face itself loads once
      return c;
    },
    draw(ctx, frame) {
      if (!chart || frame.nowMs > countInSettings.frameMs * 2) return;
      const reduced = reducedMotion();
      const c = countInAt(beats, frame.nowMs, reduced);
      const log = typeof window !== "undefined" ? window.__pianoArcadeCountIn : undefined;
      if (log && log.frames.length < 2000)
        log.frames.push({ perfMs: performance.now(), nowMs: frame.nowMs, beat: c.beat, numeral: c.numeral?.text ?? null, alpha: c.numeral?.alpha ?? 0, scale: c.numeral?.scale ?? 1, ticks: c.ticks.filter((t) => t >= 1).length, pulse: c.pulse, hot: c.hot });
      drawCountIn(ctx, frame, c, reduced);
    },
  };
}

declare global {
  interface Window {
    __pianoArcadeCountIn?: { beats: number[]; frames: CountInFrame[] }; // read by verify-count-in.mjs
  }
}
