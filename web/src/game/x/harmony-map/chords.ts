// What's sounding, and which triad it is (spec: harmony-map). The namer is jam-mode's (spikes/jam-mode/jam.mjs
// nameChord, eric-agent-3's spike), ported here because spikes/ is outside web/: each root × quality scores
// |held ∩ template| − |template − held| − |held − template|, and that score is the confidence. A triangle lights only
// when the namer's pick is a major or minor triad at `minScore` or more and it's the only triad fully present: an
// augmented chord, a cluster, a dyad or a major seventh (two full triads) lights its nodes and no triangle.
// Values: specs/decisions/harmony-map-chords.md.
import type { Chart } from "../../../contracts";
import type { Pedal } from "../../pedal";
import { NAMES, type Triad } from "./tonnetz";

export const chordSettings = {
  minScore: 2, // a triad with one extra note still lights (C E G D); two extras don't
  windowBeats: 1, // a strike's set: what's still sounding, plus what was struck in the beat up to it (an arpeggio adds up)
  liveWindowMs: 350, // the same for a live player, in ms: a rolled chord, not the last chord's keys
};

const QUALITIES: [string, number[], string][] = [
  ["major", [0, 4, 7], ""],
  ["minor", [0, 3, 7], "m"],
  ["7", [0, 4, 7, 10], "7"],
  ["maj7", [0, 4, 7, 11], "maj7"],
  ["m7", [0, 3, 7, 10], "m7"],
  ["dim", [0, 3, 6], "dim"],
  ["aug", [0, 4, 8], "+"],
  ["sus2", [0, 2, 7], "sus2"],
  ["sus4", [0, 5, 7], "sus4"],
  ["power", [0, 7], "5"],
];

export function nameChord(held: readonly number[]): { root: number; quality: string; name: string; score: number } | null {
  const pcs = new Set(held.map((p) => ((p % 12) + 12) % 12));
  if (pcs.size < 2) return null;
  const low = Math.min(...held) % 12;
  let best: { rank: number[]; root: number; quality: string; name: string } | null = null;
  for (let root = 0; root < 12; root++)
    QUALITIES.forEach(([quality, steps, suffix], q) => {
      const t = new Set(steps.map((s) => (root + s) % 12));
      let hit = 0;
      for (const p of t) if (pcs.has(p)) hit++;
      const rank = [hit - (t.size - hit) - (pcs.size - hit), root === low ? 1 : 0, -q];
      if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && (rank[1] > best.rank[1] || (rank[1] === best.rank[1] && rank[2] > best.rank[2]))))
        best = { rank, root, quality, name: NAMES[root] + suffix };
    });
  const b = best!;
  return b.rank[0] <= 0 ? null : { root: b.root, quality: b.quality, name: b.name, score: b.rank[0] };
}

export const fullTriads = (pcs: ReadonlySet<number>): Triad[] =>
  NAMES.flatMap((_, root) =>
    [false, true].filter((minor) => pcs.has(root) && pcs.has((root + (minor ? 3 : 4)) % 12) && pcs.has((root + 7) % 12)).map((minor) => ({ root, minor })),
  );

export interface Reading {
  pcs: number[]; // the sounding pitch classes, ascending: the nodes that glow
  triad: Triad | null; // the one triangle, or none
  name: string | null; // the namer's name, triad or not
}

export function read(pitches: readonly number[], s = chordSettings): Reading {
  const set = new Set(pitches.map((p) => ((p % 12) + 12) % 12));
  const named = nameChord(pitches);
  const full = fullTriads(set);
  const isTriad = !!named && (named.quality === "major" || named.quality === "minor") && named.score >= s.minScore && full.length === 1;
  return { pcs: [...set].sort((a, b) => a - b), triad: isTriad ? full[0] : null, name: named?.name ?? null };
}

// A note's end, held on to the pedal's up when the pedal is down as it's released.
const endOf = (end: number, pedal: Pedal | null) => pedal?.find(([d, u]) => d <= end && end < u)?.[1] ?? end;

// A chart's reading at each strike (only a struck key renames: decision jam-mode-spike-rename), in beats.
export function chartReadings(chart: Chart, pedal: Pedal | null, s = chordSettings): { beat: number; reading: Reading }[] {
  const notes = chart.notes.map((n) => ({ pitch: n.pitch, on: n.beat, off: endOf(n.beat + n.duration, pedal) }));
  const strikes = [...new Set(chart.notes.map((n) => n.beat))].sort((a, b) => a - b);
  return strikes.map((beat) => ({
    beat,
    reading: read(notes.filter((n) => n.on <= beat + 1e-9 && (n.off > beat + 1e-9 || n.on > beat - s.windowBeats)).map((n) => n.pitch), s),
  }));
}
