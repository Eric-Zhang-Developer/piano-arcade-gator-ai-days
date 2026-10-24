// A chart's level, 1 to 15, from the chart alone (spec: difficulty). Pure: song select calls it at build time, and
// the WARNING card at play time.
import type { Chart } from "../../contracts";
import { msPerBeat } from "../core/settings";

// Calibrated on the charts on main so the song-pack rungs keep their order (the done note lists every level).
// Tune these, not the inputs.
export const difficultySettings = {
  weights: { nps: 1, chordShare: 1, maxLeap: 0.7, range: 0.05, bothHands: 2 },
  offset: -6, // the weighted sum where level 1 sits
  scale: 0.4, // levels per point of the sum
  windowMs: 10_000, // nps counts the busiest window this long
  warnFrom: 13, // the WARNING card shows from this level
};

export interface DifficultyInputs {
  nps: number; // notes per second over the busiest 10 s
  chordShare: number; // 0–1: notes that share their beat with another note
  maxLeap: number; // semitones: the largest jump between one hand's consecutive onsets (its top or bottom note)
  range: number; // semitones: highest pitch minus lowest
  bothHands: boolean;
}

export function difficultyInputs(chart: Chart): DifficultyInputs {
  const notes = chart.notes;
  const mpb = msPerBeat(chart.bpm);
  const times = notes.map((n) => n.beat * mpb).sort((a, b) => a - b);
  let busiest = 0;
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i] - times[j] >= difficultySettings.windowMs) j++;
    busiest = Math.max(busiest, i - j + 1);
  }

  const perBeat = new Map<number, number>();
  for (const n of notes) perBeat.set(n.beat, (perBeat.get(n.beat) ?? 0) + 1);
  const chordNotes = notes.filter((n) => perBeat.get(n.beat)! >= 2).length;

  let maxLeap = 0;
  const hands = new Set(notes.map((n) => n.hand));
  for (const hand of hands) {
    const onsets = new Map<number, { lo: number; hi: number }>();
    for (const n of notes) {
      if (n.hand !== hand) continue;
      const o = onsets.get(n.beat);
      onsets.set(n.beat, o ? { lo: Math.min(o.lo, n.pitch), hi: Math.max(o.hi, n.pitch) } : { lo: n.pitch, hi: n.pitch });
    }
    const ordered = [...onsets.keys()].sort((a, b) => a - b).map((b) => onsets.get(b)!);
    for (let i = 1; i < ordered.length; i++) {
      const [a, b] = [ordered[i - 1], ordered[i]];
      maxLeap = Math.max(maxLeap, Math.abs(b.lo - a.lo), Math.abs(b.hi - a.hi));
    }
  }

  const pitches = notes.map((n) => n.pitch);
  return {
    nps: busiest / (difficultySettings.windowMs / 1000),
    chordShare: notes.length ? chordNotes / notes.length : 0,
    maxLeap,
    range: pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0,
    bothHands: hands.has("L") && hands.has("R"),
  };
}

export function difficulty(chart: Chart): { level: number; inputs: DifficultyInputs } {
  const inputs = difficultyInputs(chart);
  const { weights: w, offset, scale } = difficultySettings;
  const sum = w.nps * inputs.nps + w.chordShare * inputs.chordShare + w.maxLeap * inputs.maxLeap + w.range * inputs.range +
    w.bothHands * (inputs.bothHands ? 1 : 0);
  return { level: Math.max(1, Math.min(15, Math.round(1 + scale * (sum + offset)))), inputs };
}
