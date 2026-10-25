// Bar lines (spec: bar-lines): a faint line across the highway at each bar start, with the bar number at the left
// edge, as Synthesia draws them. Calm: never brighter than the dimmest note, and drawn under the notes.
import type { Chart } from "../../contracts";
import type { Layout } from "../core/highway";
import { msPerBeat, settings } from "../core/settings";
import { lastBar } from "../song-preview/opening";
import { ink, whenDisplayFontReady } from "../ui-tokens";

export const barLineSettings = {
  lineAlpha: 0.12, // white; the octave lines are 0.08
  labelAlpha: 0.2, // ink
  labelPx: 12, // at 720 px tall, scaled with the canvas height
};

export interface BarLine {
  atMs: number; // chart time of the bar's start
  label: number | null; // the song's bar number; null for a loop's empty bar
}

const int = (v: string | null) => (v !== null && /^\d+$/.test(v) ? Number(v) : NaN);

// One line per bar of the chart /play plays, bar 1 to its last. Each start is computed, not summed, so a beatsPerBar of
// 1.5 doesn't drift. In a bar-loop take each pass is to − from + 1 bars plus one empty bar, and the numbers are the
// song's: 5, 6, null, 5, 6. Tempo changes only the spacing, which the looped chart's bpm already carries.
export function barLines(chart: Chart, params: URLSearchParams): BarLine[] {
  const from = int(params.get("from"));
  const to = int(params.get("to"));
  const len = to - from + 1;
  const looped = len >= 1;
  const barMs = chart.beatsPerBar * msPerBeat(chart.bpm);
  return Array.from({ length: lastBar(chart) }, (_, i) => {
    const k = i % (len + 1);
    return { atMs: i * barMs, label: !looped ? i + 1 : k < len ? from + k : null };
  });
}

// Display face once it has loaded, as the judgment word does; the body face until then.
let font: string | null = null;
function labelFont(): string {
  if (font === null && typeof document !== "undefined") {
    font = "system-ui, sans-serif";
    whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) font = `${family}, system-ui, sans-serif`;
    });
  }
  return font ?? "system-ui, sans-serif";
}

// The bar numbers at the left edge, over each line on the highway; highway-field draws the lines. A line below the
// judgment line (over the keys) or above the canvas has no number.
export function drawBarLabels(ctx: CanvasRenderingContext2D, L: Layout, lines: BarLine[], nowMs: number): void {
  const s = barLineSettings;
  const line = L.judgmentLineY;
  const pxPerMs = line / settings.lookaheadMs;
  const px = Math.round((s.labelPx * L.height) / 720);
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `700 ${px}px ${labelFont()}`;
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = s.labelAlpha;
  for (const b of lines) {
    const y = line - (b.atMs - nowMs) * pxPerMs;
    if (y < 0 || y > line || b.label === null) continue;
    ctx.fillText(String(b.label), L.project(0, y) + px * 0.5, Math.round(y) + 0.5 - 2);
  }
  ctx.restore();
}
