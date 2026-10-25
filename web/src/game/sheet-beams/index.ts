// Sheet beams (spec: sheet-beams): which notes a score would beam, by the usual engraving rule, and when a beam takes
// its notes' judgment color. Pure: sheet-view measures OSMD's beaming against shouldBeam and paints beams by
// beamJudgment.
import type { Judgment } from "../../contracts";
import type { Meter, Placed } from "../sheet-xml";

// sheet-xml's divisions per quarter note (a 16th is 3, an eighth triplet 4). Not imported: sheet-xml imports
// shouldBeam to write <beam>. The tests check the two agree.
export const DIVISIONS = 12;

// The chord lengths that print as one value of a dotted eighth or shorter: a triplet 16th, a 16th, a triplet eighth,
// an eighth and a dotted eighth.
const BEAMABLE = new Set([2, 3, 4, 6, 9]);

/** A bar's beat groups, in divisions from the barline: a quarter in n/4 and 2/2, a dotted quarter in n/8 when the eighths
 * divide by 3, else a quarter. The last group is shorter when the bar doesn't divide (5/8: 4, 4, 2). */
export function beamGroups(meter: Meter): number[] {
  const bar = (meter.beats * 4 * DIVISIONS) / meter.beatType;
  const group = meter.beatType === 8 && meter.beats % 3 === 0 ? 1.5 * DIVISIONS : DIVISIONS;
  const out: number[] = [];
  for (let at = 0; at < bar; at += group) out.push(Math.min(group, bar - at));
  return out;
}

interface Chord {
  ids: string[];
  onset: number;
  end: number;
  voice: number;
}

// One staff's notes as chords (same onset and end), each in its first free voice. ponytail: mirrors sheet-xml's
// private voices(), so both agree on what a voice is; export that one if the two ever need to change together.
function voices(placed: Placed[], staff: 1 | 2): Chord[] {
  const groups = new Map<string, Chord>();
  for (const p of placed.filter((x) => x.staff === staff)) {
    const k = `${p.onset}:${p.end}`;
    const c = groups.get(k) ?? { ids: [], onset: p.onset, end: p.end, voice: 0 };
    c.ids.push(p.id);
    groups.set(k, c);
  }
  const chords = [...groups.values()].sort((a, b) => a.onset - b.onset || a.end - b.end);
  const ends: number[] = [];
  for (const c of chords) {
    let v = ends.findIndex((e) => e <= c.onset);
    if (v < 0) v = ends.length;
    ends[v] = c.end;
    c.voice = v;
  }
  return chords;
}

/** The beams a score would draw: each a list of note ids, for two or more consecutive chords of an eighth or shorter
 * in one voice of one staff, inside one beat group, with no rest between. A lone eighth isn't in any. */
export function shouldBeam(placed: Placed[], meter: Meter): string[][] {
  const sizes = beamGroups(meter);
  const bar = sizes.reduce((a, b) => a + b, 0);
  const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
  // which beat group (counted through the whole piece) a division falls in
  const groupOf = (t: number) => {
    const inBar = ((t % bar) + bar) % bar;
    let g = 0;
    while (g + 1 < starts.length && starts[g + 1] <= inBar) g++;
    return Math.floor(t / bar) * sizes.length + g;
  };

  const beams: string[][] = [];
  for (const staff of [1, 2] as const) {
    const byVoice = new Map<number, Chord[]>();
    for (const c of voices(placed, staff)) byVoice.set(c.voice, [...(byVoice.get(c.voice) ?? []), c]);
    for (const chords of byVoice.values()) {
      let run: Chord[] = [];
      const close = () => {
        if (run.length > 1) beams.push(run.flatMap((c) => c.ids));
        run = [];
      };
      for (const c of chords) {
        const fits = BEAMABLE.has(c.end - c.onset) && groupOf(c.onset) === groupOf(c.end - 1);
        if (!fits) {
          close();
          continue;
        }
        const prev = run[run.length - 1];
        if (prev && (prev.end !== c.onset || groupOf(prev.onset) !== groupOf(c.onset))) close();
        run.push(c);
      }
      close();
    }
  }
  return beams;
}

/** A beam's color: its notes' judgment once every note under it is judged and they all agree; null (ink) until then
 * and when they differ. */
export function beamJudgment(judgments: (Judgment | undefined)[]): Judgment | null {
  const [first] = judgments;
  return first && judgments.every((j) => j === first) ? first : null;
}
