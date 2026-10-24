import type { Chart } from "../../contracts";

// The keyboard for the whole take (#384): a pianist finds notes by where the keys sit, so it never moves in a song.
// From the C at or below the lowest note to the C at or above the highest, at least two octaves up from that low C,
// inside the piano's 21–108.
export function staticRange(chart: Chart): { lowPitch: number; highPitch: number } {
  const pitches = chart.notes.map((n) => n.pitch);
  const lo = Math.min(...pitches);
  const hi = Math.max(...pitches);
  let low = lo - (lo % 12);
  const high = Math.min(108, Math.max(hi + ((12 - (hi % 12)) % 12), low + 24));
  low = Math.max(21, Math.min(low, high - 24));
  return { lowPitch: low, highPitch: high };
}
