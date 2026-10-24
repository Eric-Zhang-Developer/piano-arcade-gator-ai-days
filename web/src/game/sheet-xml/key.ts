// The key (Krumhansl–Schmuckler) and how each pitch is spelled in it (spec: sheet-xml).
import type { Chart } from "../../contracts";

export type Mode = "major" | "minor";
export interface Key {
  fifths: number; // the key signature: sharps positive, flats negative
  mode: Mode;
}

// The Krumhansl–Kessler key profiles, from C. L. Krumhansl, Cognitive Foundations of Musical Pitch (Oxford University
// Press, 1990), table 2.1 (probe-tone ratings of Krumhansl & Kessler, 1982), tonic first.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlation(a: number[], b: number[]): number {
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const [ma, mb] = [mean(a), mean(b)];
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// A major key's signature from its tonic: the tonic's place on the line of fifths, kept to -5..6, so a tonic takes
// the spelling with fewer accidentals (D♭ over C♯) and the six-each tie goes to sharps (F♯ over G♭).
const fifthsOfMajor = (tonicPc: number) => {
  const f = (tonicPc * 7) % 12;
  return f > 6 ? f - 12 : f;
};
export const keyFor = (tonicPc: number, mode: Mode): Key => ({ fifths: fifthsOfMajor(mode === "major" ? tonicPc : (tonicPc + 3) % 12), mode });

// Duration-weighted pitch-class totals against the 24 rotations of the profiles: the best correlation is the key.
export function estimateKey(chart: Chart): Key & { tonicPc: number; r: number } {
  const totals = Array(12).fill(0);
  for (const n of chart.notes) totals[((n.pitch % 12) + 12) % 12] += n.duration;
  let best = { tonicPc: 0, mode: "major" as Mode, r: -Infinity };
  for (const mode of ["major", "minor"] as const)
    for (let t = 0; t < 12; t++) {
      const profile = (mode === "major" ? MAJOR : MINOR).map((_, i, p) => p[(i - t + 12) % 12]);
      const r = correlation(totals, profile);
      if (r > best.r) best = { tonicPc: t, mode, r };
    }
  return { ...keyFor(best.tonicPc, best.mode), ...best };
}

// ---------- spelling ----------

export interface Spelled {
  step: string; // C D E F G A B
  alter: number; // -1, 0 or 1 (2 or -2 never: those spellings aren't offered)
  octave: number;
}

const LETTERS = "FCGDAEB"; // the line of fifths, from F at -1
// The note at place q on the line of fifths (C is 0, G 1, F -1, F♯ 6, B♭ -2).
const atFifth = (q: number) => ({ step: LETTERS[(((q + 1) % 7) + 7) % 7], alter: Math.floor((q + 1) / 7), pc: (((q * 7) % 12) + 12) % 12 });
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const WHITE = new Set(WHITE_PCS);
const whiteStep = (pc: number) => "CDEFGAB"[WHITE_PCS.indexOf(pc)];

// pitch class -> its spelling in the key: the scale's seven notes (natural minor for a minor key), a minor key's raised
// 6th and 7th, then every other note natural on a white key, else sharp when fifths >= 0 and flat when negative.
export function spellingFor(key: Key): Map<number, { step: string; alter: number }> {
  const out = new Map<number, { step: string; alter: number }>();
  const put = (q: number) => {
    const n = atFifth(q);
    if (!out.has(n.pc)) out.set(n.pc, { step: n.step, alter: n.alter });
  };
  for (let q = key.fifths - 1; q <= key.fifths + 5; q++) put(q);
  if (key.mode === "minor") {
    const tonic = key.fifths + 3;
    put(tonic + 3); // the raised 6th (A minor: F♯)
    put(tonic + 5); // the raised 7th (A minor: G♯)
  }
  for (let pc = 0; pc < 12; pc++) {
    if (out.has(pc)) continue;
    // A black key's neighbours are white: its sharp is the white key below, raised; its flat the one above, lowered.
    if (WHITE.has(pc)) out.set(pc, { step: whiteStep(pc), alter: 0 });
    else out.set(pc, key.fifths >= 0 ? { step: whiteStep(pc - 1), alter: 1 } : { step: whiteStep(pc + 1), alter: -1 });
  }
  return out;
}

// The octave follows the letter: B♯3 is MIDI 60, C♭5 is MIDI 71.
export function spell(midi: number, table: Map<number, { step: string; alter: number }>): Spelled {
  const s = table.get(((midi % 12) + 12) % 12)!;
  return { ...s, octave: Math.floor((midi - s.alter) / 12) - 1 };
}
