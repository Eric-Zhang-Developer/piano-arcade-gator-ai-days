// Wait hint's timing (spec: wait-hint). Pure, with wall time passed in, so it tests without a page or a clock.
import type { Chart, ChartNote, Judgment } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { shouldHold } from "../wait-mode";

export const waitHintSettings = {
  afterMs: 3000, // wall time on one held note before the hint
  maxSoundMs: 1000, // the hint's note lasts its chart length, at most this
  pulseMs: 1000, // one loop of the lit key
  lowAlpha: 0.35,
  highAlpha: 0.9,
  dueGapMs: 500, // the name's bottom sits this much highway above the line
  nameFadeMs: 200, // none under reduced motion
};

// The held time's notes not yet hit: a chord's unpressed keys. Lowest first. floorMs: a rewind's bar start, as the clock's.
export function waitingNotes(chart: Chart, hits: ReadonlyMap<string, Judgment>, nowMs: number, floorMs = -Infinity): ChartNote[] {
  const at = shouldHold(chart, hits, nowMs, floorMs);
  if (at === null) return [];
  return chart.notes.filter((n) => noteTimeMs(chart, n) === at && !hits.has(n.id)).sort((a, b) => a.pitch - b.pitch);
}

// One hint at a time: it starts afterMs of wall time after a hold begins (or after a resume), sounds once, and ends
// when the hold moves on. heldKey: the held chart time ("" when nothing holds), so pressing one key of a chord keeps
// the hint on the others, and the next note starts over.
export function hintTimer() {
  let key = "";
  let since = 0;
  let sounded = false;
  let paused = false;
  return {
    reset() {
      key = "";
      sounded = false;
      paused = false;
    },
    pause() {
      paused = true;
    },
    resume(perfNow: number) {
      paused = false;
      since = perfNow;
      sounded = false; // a new wait, which may sound once more
    },
    // Each frame: whether the hint shows, whether to sound it now, and since when it showed.
    frame(heldKey: string, perfNow: number): { show: boolean; sound: boolean; shownAt: number } {
      if (paused || !heldKey) {
        if (!heldKey) key = "";
        return { show: false, sound: false, shownAt: 0 };
      }
      if (heldKey !== key) {
        key = heldKey;
        since = perfNow;
        sounded = false;
      }
      const show = perfNow - since >= waitHintSettings.afterMs;
      const sound = show && !sounded;
      if (sound) sounded = true;
      return { show, sound, shownAt: since + waitHintSettings.afterMs };
    },
  };
}
