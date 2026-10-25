// Wait mode: the chart clock holds at each note until it's pressed (spec: wait-mode). Pure, so it tests without a page.
import type { Chart, Judgment } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { pauseClock } from "../play-slots";

export const isWaitMode = (params: URLSearchParams) => params.get("mode") === "wait";

// The chart time to hold at: the earliest unjudged note, once it's due. null plays on. A chord's notes share a time,
// so the hold lasts until every one of them is judged. Notes before floorMs (skipped by a rewind's →) are never held.
export function shouldHold(chart: Chart, noteState: ReadonlyMap<string, Judgment>, nowMs: number, floorMs = -Infinity): number | null {
  let at: number | null = null;
  for (const n of chart.notes) {
    const t = noteTimeMs(chart, n);
    if (t <= nowMs && t >= floorMs && !noteState.has(n.id) && (at === null || t < at)) at = t;
  }
  return at;
}

// rewind (spec: rewind): the bar start ← (dir -1) or → (+1) goes to from nowMs, or null. ← goes to the start of the bar
// before the one nowMs is in (bar 1 stays at its start); → to the next bar's start, null in the last bar.
export function barStep(barStarts: readonly number[], nowMs: number, dir: -1 | 1): number | null {
  let i = 0;
  while (i + 1 < barStarts.length && barStarts[i + 1] <= nowMs + 1e-6) i++; // float error at a bar start counts as in it
  if (dir < 0) return barStarts[Math.max(0, i - 1)] ?? null;
  return i + 1 < barStarts.length ? barStarts[i + 1] : null;
}

// Chart time with the holds taken out, over an outer clock (the pause clock's chart time). update() runs once a frame;
// now() only reads, so input can ask for its own timestamp's time. While holding, now() is the held note's time, exactly:
// read back through the pause clock, (at + zero) - zero can land a float past it, and hand-mode would then send the
// other hand's note at that time while yours is still held (#592).
export function holdClock(chart: Chart, noteState: ReadonlyMap<string, Judgment>) {
  let hold = pauseClock(0);
  let held: number | null = null;
  let floor = -Infinity;
  const now = (outerMs: number) => held ?? hold.now(outerMs);
  return {
    update(outerMs: number) {
      const at = shouldHold(chart, noteState, now(outerMs), floor);
      if (at === null) {
        hold.resume(outerMs);
        held = null;
      } else {
        hold.pause(hold.toPerf(at)); // from the outer moment the note reached the line
        held ??= at;
      }
    },
    now,
    toOuter: (chartMs: number) => hold.toPerf(chartMs),
    // rewind: from outerMs on, the clock reads chartMs, and notes before it are never held for.
    seek(chartMs: number, outerMs: number) {
      hold = pauseClock(outerMs - chartMs);
      held = null;
      floor = chartMs;
      this.update(outerMs);
    },
    get holding() {
      return hold.paused;
    },
  };
}
