// Easy charts' derivation (spec: easy-charts), pure: every kept note is an original note, unchanged.
import type { Chart, ChartNote } from "../../contracts";
import { keyMap } from "../core/input";

export const easySettings = {
  maxNps: 4, // at most this many note starts a second, both hands together; a starting value, not a finding
};

const msAt = (chart: Chart, n: ChartNote) => (n.beat * 60000) / chart.bpm;

export function easyChart(chart: Chart): Chart {
  // 1. Chords: of one hand's notes on the same beat, the highest pitch.
  const top = new Map<string, ChartNote>();
  for (const n of chart.notes) {
    const k = `${n.hand}@${n.beat}`;
    const t = top.get(k);
    if (!t || n.pitch > t.pitch) top.set(k, n);
  }
  let notes = [...top.values()];

  // 2. Hands: both only if every pitch left is on the laptop keys; else the right hand, or the left without one.
  const laptop = new Set(keyMap(Math.min(...notes.map((n) => n.pitch))).values());
  if (!notes.every((n) => laptop.has(n.pitch))) {
    const hand = notes.some((n) => n.hand === "R") ? "R" : "L";
    notes = notes.filter((n) => n.hand === hand);
  }

  // 3. Runs: in time order, right before left on a tie, drop a start under 1000 / maxNps ms after the last kept one.
  notes.sort((a, b) => a.beat - b.beat || (a.hand === b.hand ? 0 : a.hand === "R" ? -1 : 1));
  const gap = 1000 / easySettings.maxNps;
  const kept = new Set<ChartNote>();
  let last = -Infinity;
  for (const n of notes) {
    const t = msAt(chart, n);
    if (t - last < gap - 1e-6) continue; // the epsilon keeps a gap of exactly 250 ms (8ths at 120 bpm)
    kept.add(n);
    last = t;
  }
  return { ...chart, notes: chart.notes.filter((n) => kept.has(n)) };
}
