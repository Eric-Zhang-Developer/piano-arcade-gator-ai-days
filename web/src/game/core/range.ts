import type { Chart } from "../../contracts";

export interface KeyRange {
  lowPitch: number;
  highPitch: number;
}

const PIANO = { lo: 21, hi: 108 };
const MIN = 48; // four octaves (specs/decisions/static-keyboard-min-4-octaves.md; 24 undoes it)
const HOME = { lo: 36, hi: 84 }; // C2–C6: every chart that fits inside gets exactly this

// The keyboard for the whole take (spec: static-keyboard): a pianist finds notes by where the keys sit, so it never
// moves in a song. From the C at or below the lowest note to the C at or above the highest, inside the piano's
// 21–108. A chart inside C2–C6 gets C2–C6, so most songs share one keyboard. Any other chart under four octaves
// gets the missing octaves split between its ends, the odd one above; an octave that can't go on one side goes on
// the other.
export function staticRange(chart: Chart): KeyRange {
  const pitches = chart.notes.map((n) => n.pitch);
  const lo = Math.min(...pitches);
  const hi = Math.max(...pitches);
  let low = Math.max(PIANO.lo, lo - (lo % 12));
  let high = Math.min(PIANO.hi, hi + ((12 - (hi % 12)) % 12));
  if (low >= HOME.lo && high <= HOME.hi) return { lowPitch: HOME.lo, highPitch: HOME.hi };
  const missing = Math.max(0, Math.ceil((MIN - (high - low)) / 12));
  let below = Math.floor(missing / 2);
  let above = missing - below;
  while (above > 0 && high + 12 * above > PIANO.hi) [above, below] = [above - 1, below + 1];
  while (below > 0 && low - 12 * below < PIANO.lo) [above, below] = [above + 1, below - 1];
  low -= 12 * below;
  high += 12 * above;
  return { lowPitch: Math.max(PIANO.lo, low), highPitch: Math.min(PIANO.hi, high) };
}
