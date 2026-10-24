import type { Chart, Frame, GamePlugin, Hand } from "../../contracts";
import { msPerBeat, settings } from "../core/settings";

// The two hands' colors: --pa-hand-r and --pa-hand-l in visual-direction.md (mint is today's note color). Simulated
// with Machado 2009 they stay apart under protanopia (ΔE 65), deuteranopia (62) and tritanopia (26, the closest).
export const handColorSettings = {
  colors: { R: "#5ef2c4", L: "#6aa8ff" } as Record<Hand, string>,
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
      const size = 28;
      const y = frame.judgmentLineY - 72;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = "700 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      (["L", "R"] as const).forEach((hand, i) => {
        const x = frame.width / 2 + (i ? 8 : -8 - size);
        ctx.fillStyle = handColor(hand);
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 6);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.fillText(hand, x + size / 2, y + size / 2 + 1);
      });
      ctx.restore();
    },
  };
}
