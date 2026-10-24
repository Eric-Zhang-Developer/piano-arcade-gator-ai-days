import type { Chart } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { KEYS_VELOCITY } from "../core/settings";
import { keyOff, keyOn, type TimelineEntry } from "./fake";

const HOLD_MS = 100; // the same hold as core's test input

// The Perfect player as raw piano bytes: every chart note exactly on time, on the chart clock.
export function botTimeline(chart: Chart): TimelineEntry[] {
  return chart.notes
    .flatMap((n) => {
      const t = noteTimeMs(chart, n);
      return [
        { timeMs: t, bytes: keyOn(n.pitch, KEYS_VELOCITY) },
        { timeMs: t + HOLD_MS, bytes: keyOff(n.pitch) },
      ];
    })
    .sort((a, b) => a.timeMs - b.timeMs);
}
