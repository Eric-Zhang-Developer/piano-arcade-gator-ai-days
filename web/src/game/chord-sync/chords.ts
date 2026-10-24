// Chord sync (spec: chord-sync): which chords this take rolled, per hand. Pure: chart, take and results in.
import type { Chart, Hand, Results, Take } from "../../contracts";
import { barAndBeat } from "../take-graph/graph";

export const chordSyncSettings = {
  maxSpreadMs: 30, // a chord spread over this is rolled; exactly this isn't (catalog G02)
};

export type Direction = "low to high" | "high to low" | "mixed";

export interface ChordResult {
  hand: Hand;
  beat: number; // chart beat
  spreadMs: number | null; // null: fewer than 2 notes hit (incomplete)
  direction: Direction | null;
}

// 2 or more chart notes in the same hand at the same beat; the two hands at one beat are two chords.
export function findChords(chart: Chart): { hand: Hand; beat: number; notes: number[] }[] {
  const groups = new Map<string, { hand: Hand; beat: number; notes: number[] }>();
  chart.notes.forEach((n, i) => {
    const key = `${n.hand}@${n.beat}`;
    const g = groups.get(key) ?? { hand: n.hand, beat: n.beat, notes: [] };
    g.notes.push(i);
    groups.set(key, g);
  });
  return [...groups.values()].filter((g) => g.notes.length >= 2).sort((a, b) => a.beat - b.beat || (a.hand === "L" ? -1 : 1));
}

// Low to high: the lowest pitch came first and the highest last. High to low: the other way round.
export function direction(presses: { pitch: number; timeMs: number }[]): Direction {
  const byTime = [...presses].sort((a, b) => a.timeMs - b.timeMs);
  const pitches = presses.map((p) => p.pitch);
  const [lo, hi] = [Math.min(...pitches), Math.max(...pitches)];
  const [first, last] = [byTime[0].pitch, byTime[byTime.length - 1].pitch];
  if (first === lo && last === hi) return "low to high";
  if (first === hi && last === lo) return "high to low";
  return "mixed";
}

// results.judgments is in chart order (one per chart note), so judgments[i] is notes[i]'s.
export function scoreChords(chart: Chart, take: Take, results: Results): ChordResult[] {
  return findChords(chart).map(({ hand, beat, notes }) => {
    const presses = notes.flatMap((i) => {
      const j = results.judgments[i];
      return j.eventIndex === null ? [] : [{ pitch: chart.notes[i].pitch, timeMs: take.events[j.eventIndex].timeMs }];
    });
    if (presses.length < 2) return { hand, beat, spreadMs: null, direction: null };
    const times = presses.map((p) => p.timeMs);
    return { hand, beat, spreadMs: Math.max(...times) - Math.min(...times), direction: direction(presses) };
  });
}

export const isRolled = (c: ChordResult) => c.spreadMs !== null && c.spreadMs > chordSyncSettings.maxSpreadMs;

const handName = { L: "left hand", R: "right hand" };

// The panel's lines: "3 of 14 chords rolled", then "Bar 4, beat 1, left hand: 48 ms, low to high" per rolled chord.
// Null when the chart has no chords.
export function describeChords(chart: Chart, chords: ChordResult[]): { summary: string; rows: string[] } | null {
  if (!chords.length) return null;
  const rolled = chords.filter(isRolled);
  return {
    summary: `${rolled.length} of ${chords.length} chord${chords.length === 1 ? "" : "s"} rolled`,
    rows: rolled.map((c) => {
      const { bar, beat } = barAndBeat(c.beat, chart.beatsPerBar);
      return `Bar ${bar}, beat ${Math.round(beat * 100) / 100}, ${handName[c.hand]}: ${Math.round(c.spreadMs!)} ms, ${c.direction}`;
    }),
  };
}
