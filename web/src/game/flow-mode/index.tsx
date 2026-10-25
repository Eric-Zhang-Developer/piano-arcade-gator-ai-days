// Flow mode's plugin (spec: flow-mode): the tempo readout under the HUD band, a soft glow on the note the clock waits
// at, a calm "Take your time" once a stop runs past the free beats, "Play in Flow" on the start screen and the results
// headline. The page builds the judge and its clock (core-loop); this only reads them, through FlowJudge.live.
import type { CSSProperties } from "react";
import type { Chart, Frame, GamePlugin, Hand } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { msPerBeat, settings } from "../core/settings";
import { noteColorFor } from "../hand-colors";
import { hudLayout, hudSettings } from "../hud";
import { bg, cyan, fontDisplay, ink, inkDim, panel, whenDisplayFontReady } from "../ui-tokens";
import { waitHintSettings } from "../wait-hint/hint";
import { flowSettings, isFlowMode } from "./clock";
import { FlowJudge } from "./judge";
import { headline } from "./steady";

export const flowLook = {
  breatheMs: 1800, // the glow's slow pulse while the clock holds
  glowLow: 0.35,
  glowHigh: 0.75,
  calmFadeMs: 250, // "Take your time" fades in over this
};

export interface FlowHook {
  rate: number;
  holding: boolean;
  slips: number;
  front: number | null;
  calm: boolean; // "Take your time" is showing
}

declare global {
  interface Window {
    __pianoArcadeFlow?: FlowHook | null; // read by verify-flow.mjs
  }
}

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () =>
  (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

export function flowUrl(params: URLSearchParams): string {
  const q = new URLSearchParams(params);
  q.set("mode", "flow");
  return `/play?${q}`;
}

export function flowMode(): GamePlugin {
  let flow = false;
  let chart: Chart | null = null;
  let tempo = 1; // ?tempo= as a fraction: bar-loop already slowed the chart by it, so the percent is of the song's own
  let color: (hand: Hand) => string = () => ink;
  let display = "system-ui, sans-serif";
  let calmFrom: number | null = null; // performance.now() when "Take your time" appeared
  let heldFrom: number | null = null; // performance.now() when the current hold began, for the glow's phase
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const f = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (f) display = `${f}, system-ui, sans-serif`;
    });
  const setHook = (v: FlowHook | null) => {
    if (typeof window !== "undefined") window.__pianoArcadeFlow = v;
  };

  return {
    id: "flow-mode",
    transformChart(c, params) {
      flow = isFlowMode(params);
      chart = c;
      tempo = params.has("tempo") ? Number(params.get("tempo")) / 100 : 1;
      color = noteColorFor(c);
      calmFrom = heldFrom = null;
      setHook(null);
      return c;
    },
    draw(ctx, f) {
      const judge = FlowJudge.live;
      if (!flow || !chart || !judge) return;
      const { clock } = judge;
      const now = performance.now();
      const mpb = msPerBeat(chart.bpm);
      const calm = clock.holding && clock.heldMs > (flowSettings.freeBeats * mpb) / clock.rate;
      heldFrom = clock.holding ? (heldFrom ?? now) : null;
      calmFrom = calm ? (calmFrom ?? now) : null;
      drawReadout(ctx, f, Math.round(chart.bpm * clock.rate), Math.round(tempo * clock.rate * 100), display);
      if (clock.holding && clock.front !== null) {
        const front = clock.front;
        const waiting = chart.notes.filter((n) => noteTimeMs(chart!, n) === front && !judge.noteState.has(n.id));
        drawGlow(ctx, f, waiting.map((n) => ({ pitch: n.pitch, color: color(n.hand) })), now - heldFrom!);
        if (calm && waiting.length) drawCalm(ctx, f, waiting.map((n) => n.pitch), now - calmFrom!, display);
      }
      setHook({ rate: clock.rate, holding: clock.holding, slips: judge.slips, front: clock.front, calm });
    },
    startPanel: ({ params }) =>
      isFlowMode(params) ? (
        <p style={{ opacity: 0.7, margin: 0 }}>Flow: the song waits for you and follows your tempo.</p>
      ) : (
        <a data-testid="play-flow" href={flowUrl(params)} style={link}>
          Play in Flow
        </a>
      ),
    resultsPanel: ({ params, results }) => {
      const judge = FlowJudge.live;
      if (!isFlowMode(params) || !judge) return null;
      return (
        <p data-testid="flow-headline" style={headlineStyle}>
          {headline(results, judge.slips, judge.deviations)}
        </p>
      );
    },
  };
}

// Under the HUD band, right-aligned with the score: ♩ 92 · 115%, in a cyan frame as wait mode's LEARN badge.
function drawReadout(ctx: CanvasRenderingContext2D, f: Frame, bpm: number, percent: number, display: string) {
  const { h } = hudLayout(f.width, f.judgmentLineY).panel;
  const pad = Math.max(10, h * 0.25);
  const px = Math.round(h * 0.34);
  const right = f.width - pad - hudSettings.statusGutterPx;
  const top = h + pad * 0.5;
  ctx.save();
  ctx.font = `italic 800 ${px}px ${display}`;
  const bpmText = `♩ ${bpm}`;
  const pctText = ` · ${percent}%`;
  const bw = ctx.measureText(bpmText).width;
  const pw = ctx.measureText(pctText).width;
  const w = bw + pw + px * 1.1;
  const bh = px * 1.5;
  ctx.fillStyle = panel;
  ctx.strokeStyle = cyan;
  ctx.lineWidth = Math.max(1.5, h * 0.025);
  ctx.beginPath();
  ctx.roundRect(right - w, top, w, bh, bh * 0.28);
  ctx.fill();
  ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const x = right - w + px * 0.55;
  ctx.fillStyle = ink;
  ctx.fillText(bpmText, x, top + bh / 2);
  ctx.fillStyle = inkDim;
  ctx.fillText(pctText, x + bw, top + bh / 2);
  ctx.restore();
}

// The waiting note's glow: a soft column of its hand's color rising from the hit line, breathing while it waits.
function drawGlow(ctx: CanvasRenderingContext2D, f: Frame, keys: { pitch: number; color: string }[], heldMs: number) {
  const l = flowLook;
  const a = reducedMotion() ? (l.glowLow + l.glowHigh) / 2 : l.glowLow + ((l.glowHigh - l.glowLow) * (1 - Math.cos((2 * Math.PI * heldMs) / l.breatheMs))) / 2;
  const line = f.judgmentLineY;
  const rise = line * 0.16;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const { pitch, color } of keys) {
    const k = f.keyX(pitch);
    const cx = k.x + k.width / 2;
    const half = Math.max(k.width * 1.6, 14);
    const g = ctx.createLinearGradient(0, line, 0, line - rise);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = a * 0.6;
    ctx.fillStyle = g;
    ctx.fillRect(cx - k.width / 2, line - rise, k.width, rise);
    const r = ctx.createRadialGradient(cx, line, 0, cx, line, half);
    r.addColorStop(0, color);
    r.addColorStop(1, "transparent");
    ctx.globalAlpha = a;
    ctx.fillStyle = r;
    ctx.beginPath();
    ctx.ellipse(cx, line, half, half * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// "Take your time" over the waiting note, where wait-hint puts a note's name: calm ink, never red.
function drawCalm(ctx: CanvasRenderingContext2D, f: Frame, pitches: number[], shownMs: number, display: string) {
  const xs = pitches.map((p) => f.keyX(p));
  const cx = (Math.min(...xs.map((k) => k.x)) + Math.max(...xs.map((k) => k.x + k.width))) / 2;
  const px = Math.round(0.05 * f.height);
  const text = "Take your time";
  ctx.save();
  ctx.globalAlpha = reducedMotion() ? 1 : Math.min(1, shownMs / flowLook.calmFadeMs);
  ctx.font = `italic 800 ${px}px ${display}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const half = ctx.measureText(text).width / 2;
  const x = Math.max(half + 8, Math.min(f.width - half - 8, cx));
  const y = f.judgmentLineY * (1 - waitHintSettings.dueGapMs / settings.lookaheadMs);
  ctx.lineJoin = "round";
  ctx.lineWidth = px * 0.16;
  ctx.strokeStyle = bg;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y);
  ctx.restore();
}

const link: CSSProperties = {
  display: "inline-block",
  padding: "8px 24px",
  fontSize: 16,
  borderRadius: 8,
  background: "#ddd",
  color: "#000",
  textDecoration: "none",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: fontDisplay,
  fontStyle: "italic",
  fontWeight: 800,
  fontSize: "clamp(18px, 1.6vw, 28px)",
  color: ink,
  textAlign: "center",
};
