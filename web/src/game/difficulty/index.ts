// The WARNING card (spec: difficulty, catalog G05): at level 13 or above, a full-width card with the level shows
// during the first bar of the count-in. /play?warn=1 shows it on any song, for testing. No siren (mission.md).
import type { Chart, Frame, GamePlugin } from "../../contracts";
import { settings, msPerBeat } from "../core/settings";
import { meterLayout } from "../fever-gauge";
import { ink, inkDim, panel, primary, whenDisplayFontReady } from "../ui-tokens";
import { difficulty, difficultySettings } from "./difficulty";

export { difficulty, difficultyInputs, difficultySettings } from "./difficulty";

// Chart time of the count-in's first bar: from the first count-in beat to the start of the second bar.
export function firstCountInBar(chart: Pick<Chart, "bpm" | "beatsPerBar">): { fromMs: number; toMs: number } {
  const mpb = msPerBeat(chart.bpm);
  const fromMs = -settings.countInBeats * mpb;
  return { fromMs, toMs: fromMs + Math.min(chart.beatsPerBar, settings.countInBeats) * mpb };
}

// A band across the playfield, between the fever meter's label and the count-in digit, which core draws at 0.45 of
// the judgment line with an em of 0.3 (its top near 0.34).
export const countInDigitTop = (judgmentLineY: number) => judgmentLineY * 0.34;

export function warningLayout(width: number, judgmentLineY: number) {
  const y = meterLayout(width, judgmentLineY).bottom + 4;
  return { x: 0, y, w: width, h: countInDigitTop(judgmentLineY) - 4 - y };
}

function drawWarning(ctx: CanvasRenderingContext2D, f: Frame, level: number, font: string): void {
  const b = warningLayout(f.width, f.judgmentLineY);
  ctx.fillStyle = panel;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = primary; // cabinet chrome: the card's frame
  ctx.fillRect(b.x, b.y, b.w, 3);
  ctx.fillRect(b.x, b.y + b.h - 3, b.w, 3);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.font = `900 ${Math.round(b.h * 0.46)}px ${font}`;
  ctx.fillText("WARNING", b.w / 2, b.y + b.h * 0.4);
  ctx.fillStyle = inkDim;
  ctx.font = `800 ${Math.max(16, Math.round(b.h * 0.22))}px ${font}`; // readable on video (visual-direction.md)
  ctx.fillText(`Lv ${level}`, b.w / 2, b.y + b.h * 0.8);
}

declare global {
  interface Window {
    __pianoArcadeWarning?: { level: number; show: boolean }; // read by verify-warning.mjs
  }
}

export function warningCard(): GamePlugin {
  let show = false;
  let level = 0;
  let bar = { fromMs: 0, toMs: 0 };
  let font = "system-ui, sans-serif";
  return {
    id: "difficulty-warning",
    transformChart(chart, params) {
      level = difficulty(chart).level;
      show = level >= difficultySettings.warnFrom || params.get("warn") === "1";
      bar = firstCountInBar(chart);
      if (typeof window !== "undefined") window.__pianoArcadeWarning = { level, show };
      if (show && typeof document !== "undefined") {
        // Canvas can't read var(--pa-font-display): resolve the family once Saira is ready.
        void whenDisplayFontReady().then(() => {
          const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
          if (family) font = `${family}, system-ui, sans-serif`;
        });
      }
      return chart;
    },
    draw(ctx, frame) {
      if (show && frame.nowMs >= bar.fromMs && frame.nowMs < bar.toMs) drawWarning(ctx, frame, level, font);
    },
  };
}
