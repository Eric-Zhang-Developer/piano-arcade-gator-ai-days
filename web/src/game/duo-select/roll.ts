// A chart's opening as piano-roll bars for the select's thumbnails (spec: duo-select). Pure: the canvas draws what this
// returns. Time runs left to right over the first `bars` bars (fewer if the song is shorter), pitch bottom to top.
import type { Chart, Hand } from "../../contracts";
import { handL, handR } from "../ui-tokens";

export interface RollBar {
  x: number; // start, 0–1 across the window
  w: number; // length, 0–1, cut at the window's end
  row: number; // pitch - low: 0 is the lowest pitch in the window
  hand: Hand;
  color: string; // the hand's color: right in the primary, left in the secondary
}

export interface Roll {
  bars: RollBar[];
  rows: number; // high - low + 1, at least 1
  barLines: number[]; // 0–1, where each bar after the first starts
}

export const EMPTY_ROLL: Roll = { bars: [], rows: 1, barLines: [] };

export function roll(chart: Pick<Chart, "notes" | "beatsPerBar">, bars = 8): Roll {
  const per = chart.beatsPerBar > 0 ? chart.beatsPerBar : 4;
  if (chart.notes.length === 0) return EMPTY_ROLL;
  // A pickup starts before beat 0: the window starts at its bar, so it isn't cut off.
  const start = Math.min(0, Math.floor(Math.min(...chart.notes.map((n) => n.beat)) / per) * per);
  const lastEnd = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  const span = Math.min(bars * per, Math.ceil((lastEnd - start) / per) * per) || per;
  const end = start + span;
  const shown = chart.notes.filter((n) => n.beat >= start && n.beat < end);
  const low = Math.min(...shown.map((n) => n.pitch));
  const high = Math.max(...shown.map((n) => n.pitch));
  return {
    bars: shown.map((n) => ({
      x: (n.beat - start) / span,
      w: (Math.min(n.beat + n.duration, end) - n.beat) / span,
      row: n.pitch - low,
      hand: n.hand,
      color: n.hand === "L" ? handL : handR,
    })),
    rows: high - low + 1,
    barLines: Array.from({ length: span / per - 1 }, (_, i) => ((i + 1) * per) / span),
  };
}
