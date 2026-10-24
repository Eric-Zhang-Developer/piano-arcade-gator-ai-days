// Wait mode: the chart clock holds at each note until it's pressed (spec: wait-mode). Pure, so it tests without a page.
import type { Chart, Judgment } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { pauseClock } from "../play-slots";

export const isWaitMode = (params: URLSearchParams) => params.get("mode") === "wait";

// The chart time to hold at: the earliest unjudged note, once it's due. null plays on. A chord's notes share a time,
// so the hold lasts until every one of them is judged.
export function shouldHold(chart: Chart, noteState: ReadonlyMap<string, Judgment>, nowMs: number): number | null {
  let at: number | null = null;
  for (const n of chart.notes) {
    const t = noteTimeMs(chart, n);
    if (t <= nowMs && !noteState.has(n.id) && (at === null || t < at)) at = t;
  }
  return at;
}

// Chart time with the holds taken out, over an outer clock (the pause clock's chart time). update() runs once a frame;
// now() only reads, so input can ask for its own timestamp's time. While holding, now() is the held note's time.
export function holdClock(chart: Chart, noteState: ReadonlyMap<string, Judgment>) {
  const hold = pauseClock(0);
  return {
    update(outerMs: number) {
      const at = shouldHold(chart, noteState, hold.now(outerMs));
      if (at === null) hold.resume(outerMs);
      else hold.pause(hold.toPerf(at)); // from the outer moment the note reached the line
    },
    now: (outerMs: number) => hold.now(outerMs),
    toOuter: (chartMs: number) => hold.toPerf(chartMs),
    get holding() {
      return hold.paused;
    },
  };
}
