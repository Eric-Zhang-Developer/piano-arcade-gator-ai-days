// The fever meter (spec: fever-gauge): a thin bar just under the HUD's top panel that fills toward fever and burns
// full while it lasts. It runs the judge's own reducer over the events it receives, so the two always agree.
import type { Frame, GamePlugin } from "../../contracts";
import { hudLayout, hudSettings } from "../hud";
import { bg } from "../ui-tokens";
import { isWaitMode } from "../wait-mode";
import { type Gauge, emptyGauge, reduceGauge } from "./gauge";

export const meterSettings = {
  track: "rgba(242,242,245,0.12)", // --pa-ink, faint
  fill: "#ffb02e", // FEVER's amber, the gauge #728 keeps; the --pa-sun token it came from is retired
  feverFrom: "#ffe66b", // the sun gradient, lit during fever
  feverTo: "#ff3fa4",
  label: "rgba(242,242,245,0.6)", // --pa-ink-dim
};

// Under the panel, above the giant combo: far above the HUD's safe line (the lowest 40% stays clear).
export function meterLayout(width: number, judgmentLineY: number) {
  const top = hudLayout(width, judgmentLineY).panel.h;
  const bar = { x: 0, y: top, w: width, h: Math.max(4, Math.round(top * 0.1)) };
  const labelPx = Math.max(12, Math.round(top * 0.26));
  return { bar, label: { x: Math.max(10, top * 0.25), y: bar.y + bar.h + labelPx * 0.7, px: labelPx }, bottom: bar.y + bar.h + labelPx * 1.3 };
}

function drawMeter(ctx: CanvasRenderingContext2D, f: Frame, g: Gauge): void {
  const { bar, label } = meterLayout(f.width, f.judgmentLineY);
  // Opaque under the faint track, as the HUD's band is: notes draw from y = 0 and must not cross the strip (#243).
  ctx.fillStyle = bg;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = meterSettings.track;
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  if (g.fever) {
    const grad = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
    grad.addColorStop(0, meterSettings.feverFrom);
    grad.addColorStop(1, meterSettings.feverTo);
    ctx.fillStyle = grad;
    ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  } else if (g.fill > 0) {
    ctx.fillStyle = meterSettings.fill;
    ctx.fillRect(bar.x, bar.y, (bar.w * g.fill) / g.size, bar.h);
  }
  // A word as well as a color: FEVER, dim while filling, lit while it lasts.
  ctx.fillStyle = g.fever ? meterSettings.feverFrom : meterSettings.label;
  ctx.font = `italic ${g.fever ? 900 : 700} ${label.px}px ${hudSettings.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("FEVER", label.x, label.y);
}

declare global {
  interface Window {
    __pianoArcadeFeverGauge?: Gauge; // read by verify-fever.mjs
  }
}

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
      if (!wait) drawMeter(ctx, frame, gauge);
    },
  };
}
