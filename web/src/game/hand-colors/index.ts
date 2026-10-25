import type { Chart, Frame, GamePlugin, Hand } from "../../contracts";
import { msPerBeat, settings } from "../core/settings";
import { canvasFonts } from "../duo-tokens/canvas";

// The two hands' colors: --pa-hand-r and --pa-hand-l in visual-direction.md, Duo's electric blue and purple
// (duo-tokens). The right hand's blue is also the one-hand note color (settings.noteColor).
export const handColorSettings = {
  colors: { R: "#2b9bff", L: "#a07cff" } as Record<Hand, string>,
  legendBeats: 1, // the legend fades out over the count-in's last beat, gone by beat 1
};

export const handColor = (hand: Hand): string => handColorSettings.colors[hand];

export const hasBothHands = (chart: Chart): boolean =>
  chart.notes.some((n) => n.hand === "L") && chart.notes.some((n) => n.hand === "R");

// The color for a note of this chart: by hand when it has both, today's single color when it has one.
export function noteColorFor(chart: Chart): (hand: Hand) => string {
  const both = hasBothHands(chart); // once per chart, not per note per frame
  return (hand) => (both ? handColor(hand) : settings.noteColor);
}

// "L" and "R" swatches during the count-in, only for a two-hand chart.
export function handColors(): GamePlugin {
  let chart: Chart | null = null;
  return {
    id: "hand-colors",
    transformChart(c) {
      chart = c;
      return c;
    },
    draw(ctx: CanvasRenderingContext2D, frame: Frame) {
      if (!chart || !hasBothHands(chart) || frame.nowMs >= 0) return;
      const alpha = Math.min(1, -frame.nowMs / (handColorSettings.legendBeats * msPerBeat(chart.bpm)));
      // The video rule: 16 px letters at 720 high, 24 px at 1080, the square chip and its place growing with them.
      const k = Math.min(1.5, Math.max(1, frame.height / 720));
      const size = Math.round(28 * k);
      const y = frame.judgmentLineY - Math.round(72 * k);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = canvasFonts.data(Math.round(16 * k));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      (["L", "R"] as const).forEach((hand, i) => {
        const x = frame.width / 2 + (i ? 8 * k : -8 * k - size);
        ctx.fillStyle = handColor(hand);
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = "#000";
        ctx.fillText(hand, x + size / 2, y + size / 2 + k);
      });
      ctx.restore();
    },
  };
}
