// The fever meter (spec: fever-gauge): a thin bar just under the HUD's top panel that fills toward fever and burns
// full while it lasts. It runs the judge's own reducer over the events it receives, so the two always agree.
import type { Frame, GamePlugin } from "../../contracts";
import { hudLayout, hudSettings } from "../hud";
import { bg } from "../ui-tokens";
import { isWaitMode } from "../wait-mode";
import { type Gauge, emptyGauge, reduceGauge } from "./gauge";
import { type Arc, arcNow, markLit } from "../fever-arc";

export const meterSettings = {
  track: "rgba(242,242,245,0.12)", // --pa-ink, faint
  fill: "#ffb02e", // FEVER's amber, the gauge #728 keeps; the --pa-sun token it came from is retired. Fever burns it full.
  label: "rgba(242,242,245,0.6)", // --pa-ink-dim
  shimmer: "rgba(255,255,255,0.55)", // fever-arc's build-up: a light band across the fill, once a beat
  shimmerShare: 0.18, // the band's width, as a share of the fill
};

// fever-arc's build-up, a riser: in the gauge's last stretch a light band runs across the fill once a beat, stronger as
// it nears full. Returns the band's x span (0–1 of the fill) and alpha, or null. Reduced motion: none.
export function shimmerAt(arc: Arc, still: boolean): { from: number; to: number; alpha: number } | null {
  if (still || arc.phase !== "build") return null;
  const w = meterSettings.shimmerShare;
  const from = -w + (1 + w) * arc.beat;
  return { from: Math.max(0, from), to: Math.min(1, from + w), alpha: 0.35 + 0.65 * arc.progress };
}

// Under the panel, above the giant combo: far above the HUD's safe line (the lowest 40% stays clear).
export function meterLayout(width: number, judgmentLineY: number) {
  const top = hudLayout(width, judgmentLineY).panel.h;
  const bar = { x: 0, y: top, w: width, h: Math.max(4, Math.round(top * 0.1)) };
  const labelPx = Math.max(12, Math.round(top * 0.26));
  return { bar, label: { x: Math.max(10, top * 0.25), y: bar.y + bar.h + labelPx * 0.7, px: labelPx }, bottom: bar.y + bar.h + labelPx * 1.3 };
}

function drawMeter(ctx: CanvasRenderingContext2D, f: Frame, g: Gauge, arc: Arc, still: boolean): void {
  const { bar, label } = meterLayout(f.width, f.judgmentLineY);
  // Opaque under the faint track, as the HUD's band is: notes draw from y = 0 and must not cross the strip (#243).
  ctx.fillStyle = bg;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = meterSettings.track;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  // Flat amber, filling toward fever and full while it lasts: the Duo look has no gradients (#885). It burns full
  // from fever-arc's ignition beat, and drains with its release (heat) after a break or into the results.
  const lit = arc.phase === "ignite" || arc.phase === "sustain";
  const draining = !still && (arc.phase === "release" || arc.phase === "handoff"); // reduced motion: a cut, no drain
  const share = g.fever ? 1 : Math.max(g.fill / g.size, draining ? arc.heat : 0);
  if (share > 0) {
    ctx.fillStyle = meterSettings.fill;
    ctx.fillRect(bar.x, bar.y, bar.w * share, bar.h);
    const sh = shimmerAt(arc, still);
    if (sh && sh.to > sh.from) {
      ctx.globalAlpha = sh.alpha;
      ctx.fillStyle = meterSettings.shimmer;
      ctx.fillRect(bar.x + bar.w * share * sh.from, bar.y, bar.w * share * (sh.to - sh.from), bar.h);
      ctx.globalAlpha = 1;
    }
    markLit(lit ? "meter" : "meter-fill");
  }
  // A word as well as a color: FEVER, dim while filling, lit amber from the ignition beat. Upright, as the kit's type is.
  ctx.fillStyle = lit ? meterSettings.fill : meterSettings.label;
  ctx.font = `${lit ? 900 : 700} ${label.px}px ${hudSettings.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FEVER", label.x, label.y);
}

declare global {
  interface Window {
    __pianoArcadeFeverGauge?: Gauge; // read by verify-fever.mjs
  }
}

// Read once and kept live, as the highway does.
let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

// Registered last in layers.ts, so its transformChart sees the chart the judge gets (after every other plugin's).
export function feverGauge(): GamePlugin {
  let notes = 0;
  let gauge = emptyGauge(0);
  let wait = false; // wait mode isn't scored: no meter
  const publish = () => {
    if (typeof window !== "undefined") window.__pianoArcadeFeverGauge = gauge;
  };
  return {
    id: "fever-gauge",
    transformChart(chart, params) {
      wait = isWaitMode(params);
      notes = chart.notes.length;
      gauge = emptyGauge(notes);
      publish();
      return chart;
    },
    onEvent(e) {
      gauge = e.type === "songStart" ? emptyGauge(notes) : reduceGauge(gauge, e);
      publish();
    },
    draw(ctx, frame) {
      if (!wait) drawMeter(ctx, frame, gauge, arcNow(frame.nowMs), reducedMotion());
    },
  };
}
