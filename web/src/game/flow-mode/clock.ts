// Flow mode's clock (spec: flow-mode): chart time waits for you and follows your tempo. Pure, so it tests without a page.
// Like wait mode's holdClock it runs over an outer clock (the pause clock's chart time): update() once a frame, now()
// only reads, so input can ask for its own timestamp's time.
import type { Chart, Judgment } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { noteTimeMs } from "../core/judge";

export const isFlowMode = (params: URLSearchParams) => params.get("mode") === "flow";

export const flowSettings = {
  minRate: 0.5, // the player's tempo as a fraction of the chart's, clamped to this range
  maxRate: 1.3,
  easeBeats: 0.25, // the clock eases to a stop over this much chart time before a waiting note
  tempoOnsets: 4, // rate is the mean tempo over this many played onsets (decision: flow-mode-tempo)
  freeBeats: 2, // a wait this long is free; past it the stop is a slip, and the rest doesn't count toward the tempo
  catchUpBeats: 0.5, // a note played before the clock gets there: the clock reaches it within this much wall time
  perfectBeats: 0.1, // steadiness tiers: how far a press lands from where your own tempo put it
  greatBeats: 0.2,
};

// The chart's distinct onsets, earliest first: the time and the notes that start there.
export interface Onset {
  ms: number;
  ids: string[];
}

export function onsetsOf(chart: Chart): Onset[] {
  const byMs = new Map<number, string[]>();
  for (const n of chart.notes) {
    const ms = noteTimeMs(chart, n);
    byMs.set(ms, [...(byMs.get(ms) ?? []), n.id]);
  }
  return [...byMs.entries()].sort((a, b) => a[0] - b[0]).map(([ms, ids]) => ({ ms, ids }));
}

const clampRate = (r: number) => Math.min(flowSettings.maxRate, Math.max(flowSettings.minRate, r));

// onsets are the judged hand's, so the other hand never holds the clock. An onset is played once every one of its
// notes is in noteState (hit or MISS), as holdClock does for a chord. The judge calls played() at an onset's first hit.
export function flowClock(chart: Chart, onsets: readonly Onset[], noteState: ReadonlyMap<string, Judgment>, startRate = 1) {
  const mpb = msPerBeat(chart.bpm);
  let rate = clampRate(startRate);
  let pos = 0; // chart time at the last update
  let last: number | null = null; // that update's outer time
  let floor = -Infinity; // a seek's target: onsets before it never hold the clock
  let catchTo = -Infinity; // a played onset the clock hasn't reached yet
  let catchBy = 0; // the outer time it should reach it by
  let holdFrom: number | null = null; // outer time the current hold began
  let excess = 0; // wall time held past the free beats since the last played onset
  let lastPlayed: { ms: number; outer: number } | null = null;
  const samples: number[] = [];

  const front = (): number | null => onsets.find((o) => o.ms >= floor && o.ids.some((id) => !noteState.has(id)))?.ms ?? null;

  // Chart ms per outer ms at chart time p: the tempo, faster while catching up, slowing to 0 over the ease before f.
  function speed(p: number, at: number, f: number | null): number {
    let v = rate;
    if (catchTo > p) v = Math.max(v, (catchTo - p) / Math.max(1, catchBy - at));
    if (f === null) return v;
    const ease = flowSettings.easeBeats * mpb;
    if (f - p <= 0) return 0;
    // Constant deceleration over the ease: speed falls linearly in time and reaches 0 exactly at the note.
    return f - p < ease ? Math.min(v, rate * Math.sqrt((f - p) / ease)) : v;
  }

  const read = (outerMs: number): number => {
    if (last === null) return outerMs;
    const f = front();
    const p = pos + speed(pos, last, f) * (outerMs - last);
    return f === null ? p : Math.min(p, f);
  };

  return {
    update(outerMs: number) {
      if (last === null) {
        pos = outerMs;
        last = outerMs;
      }
      // Small steps, so the ease's square-root profile lands on the note at any frame rate.
      for (let t = last; t < outerMs; ) {
        const h = Math.min(4, outerMs - t);
        const f = front();
        const next = pos + speed(pos, t, f) * h;
        pos = f === null ? next : Math.min(next, f);
        t += h;
        if (f !== null && pos >= f) holdFrom ??= t;
      }
      last = outerMs;
      if (!this.holding) holdFrom = null;
    },
    now: read,
    toOuter: (chartMs: number) => (last === null ? chartMs : last + (chartMs - pos) / rate),
    // rewind: from outerMs on, the clock reads chartMs, and notes before it never hold it. The tempo starts over.
    seek(chartMs: number, outerMs: number) {
      pos = chartMs;
      last = outerMs;
      floor = chartMs;
      catchTo = -Infinity;
      holdFrom = null;
      excess = 0;
      lastPlayed = null;
    },
    // An onset's first hit, at outer time outerMs. The tempo since the previous one becomes a sample; an onset the
    // clock hasn't reached yet is caught up to.
    played(onsetMs: number, outerMs: number) {
      if (holdFrom !== null) excess += Math.max(0, outerMs - holdFrom - (flowSettings.freeBeats * mpb) / rate);
      if (lastPlayed && onsetMs > lastPlayed.ms) {
        const wall = outerMs - lastPlayed.outer - excess;
        // Each sample is clamped too, so two onsets struck together can't drag the mean (decision: flow-mode-tempo).
        if (wall > 0) samples.push(clampRate((onsetMs - lastPlayed.ms) / wall));
        if (samples.length > flowSettings.tempoOnsets) samples.shift();
        if (samples.length) rate = clampRate(samples.reduce((a, b) => a + b, 0) / samples.length);
      }
      excess = 0;
      holdFrom = null;
      lastPlayed = { ms: onsetMs, outer: outerMs };
      if (onsetMs > read(outerMs)) {
        catchTo = Math.max(catchTo, onsetMs);
        catchBy = outerMs + (flowSettings.catchUpBeats * mpb) / rate;
      }
    },
    get rate() {
      return rate;
    },
    // A tempo sample exists, so a press's place can be predicted from the player's own tempo.
    get tempoKnown() {
      return samples.length > 0;
    },
    get holding() {
      const f = front();
      return f !== null && pos >= f;
    },
    // Wall ms the clock has held at the waiting note, as of the last update.
    get heldMs() {
      return holdFrom === null || last === null ? 0 : last - holdFrom;
    },
    get front() {
      return front();
    },
  };
}

export type FlowClock = ReturnType<typeof flowClock>;
