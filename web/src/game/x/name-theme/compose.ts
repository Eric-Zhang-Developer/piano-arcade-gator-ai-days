// Your Name, in Music (spec: name-theme, #1190): a name's motif, harmonized, then one variation, as a playable chart.
// Rule-based and deterministic: the same letters and cipher give the same chart. Every rule here is logged in
// specs/decisions/name-theme-composition.md. Pure; the cipher tables are in cipher.ts.
import type { Chart, ChartNote } from "../../../contracts";
import type { Pedal } from "../../pedal";

export type Cipher = Readonly<Record<string, number>>; // a letter → its pitch class, 0 = C

export const composeSettings = {
  maxLetters: 12, // past this the motif stops; at 12 the piece still fits 20 s at 96 bpm
  minNotes: 3, // a shorter name repeats until its motif has this many notes
  longNoteUpTo: 6, // names this short get a half note per letter, longer ones a quarter
  targetSeconds: 20,
  bpm: [60, 132] as const,
  melody: [62, 84] as const, // the right hand's register (D4–C6)
  bass: [36, 47] as const, // the left hand's lowest voice (C2–B2)
  leftTop: 59, // the left hand stays under the melody's register
  velocity: { themeMelody: 80, themeChords: 49, variationMelody: 96, variationChords: 64 }, // mf, p, f, mp on golden-demo's ladder
  pedalDown: 0.1, // beats after a new harmony
  pedalUp: 0.05, // beats before the next
};

const S = composeSettings;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
// Major keys from fewest accidentals: the first whose scale holds every motif note is the key.
const KEYS = [0, 7, 5, 2, 10, 9, 3, 4, 8, 11, 1, 6];
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// Accents fold to their letter (NFD, combining marks dropped); anything else that isn't A–Z goes; the length is capped.
export const fold = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, S.maxLetters);

export const motif = (letters: string, cipher: Cipher): number[] => [...letters].map((l) => cipher[l]);

export const pcName = (pc: number, key = 0): string => ([5, 10, 3, 8, 1, 6].includes(key) ? FLAT_NAMES : NAMES)[((pc % 12) + 12) % 12];

const keyFor = (pcs: number[]) => KEYS.find((k) => pcs.every((pc) => MAJOR.includes((pc - k + 12) % 12))) ?? 0;

// The diatonic triads used: I ii iii IV V vi, by root degree (vii° is left out).
const ROOTS = [0, 1, 2, 3, 4, 5];
const CHORD = ["I", "ii", "iii", "IV", "V", "vi"];
const tones = (root: number) => [root, (root + 2) % 7, (root + 4) % 7];
// How well one chord follows another: 0 is a common progression, higher is weaker or a retrogression.
const NEXT: Record<number, Record<number, number>> = {
  0: { 0: 1, 1: 0, 2: 2, 3: 0, 4: 0, 5: 0 },
  1: { 0: 2, 1: 1, 2: 3, 3: 1, 4: 0, 5: 2 },
  2: { 0: 2, 1: 1, 2: 1, 3: 0, 4: 2, 5: 0 },
  3: { 0: 0, 1: 0.5, 2: 3, 3: 1, 4: 0, 5: 1.5 },
  4: { 0: 0, 1: 3, 2: 3, 3: 2, 4: 1, 5: 0 },
  5: { 0: 1.5, 1: 0, 2: 1, 3: 0, 4: 1, 5: 1 },
};
const START: Record<number, number> = { 0: 0, 1: 2, 2: 2, 3: 2, 4: 1, 5: 1 };

// The cheapest chord for each melody degree (a chord must contain its note), ending into the given cadence chords.
function harmonize(degrees: number[], cadence: number[]): number[] {
  const steps = [...degrees.map((d) => ROOTS.filter((r) => tones(r).includes(d))), ...cadence.map((c) => [c])];
  let best = new Map<number, { cost: number; path: number[] }>();
  steps[0].forEach((r) => best.set(r, { cost: START[r], path: [r] }));
  for (let i = 1; i < steps.length; i++) {
    const next = new Map<number, { cost: number; path: number[] }>();
    for (const r of steps[i])
      for (const [p, b] of best) {
        const cost = b.cost + NEXT[p][r];
        if (!next.has(r) || cost < next.get(r)!.cost) next.set(r, { cost, path: [...b.path, r] });
      }
    best = next;
  }
  return [...best.values()].sort((a, b) => a.cost - b.cost)[0].path;
}

export interface Theme {
  letters: string;
  key: number;
  motif: number[]; // pitch classes, one per letter
  chords: string[]; // roman numerals, one per melody note of the theme then the variation
  chart: Chart;
  pedal: Pedal;
  letterOf: Record<string, number>; // a melody note's id → its letter's index in `letters`
  parallels: number; // parallel fifths and octaves between melody and bass, counted for the log
}

const fit = (p: number, lo: number, hi: number) => {
  while (p < lo) p += 12;
  while (p > hi) p -= 12;
  return p;
};

export function compose(letters: string, cipher: Cipher): Theme | null {
  if (!letters) return null;
  const pcs = motif(letters, cipher);
  const key = keyFor(pcs);
  const notes = [...pcs];
  const letterIdx = pcs.map((_, i) => i);
  while (notes.length < S.minNotes) {
    notes.push(pcs[notes.length % pcs.length]);
    letterIdx.push(letterIdx.length % pcs.length);
  }
  const unit = letters.length <= S.longNoteUpTo ? 2 : 1;
  const degOf = (pc: number) => MAJOR.indexOf((pc - key + 12) % 12);

  // The melody as diatonic step numbers (octave × 7 + degree): each note the nearest to the last, rising on a tie.
  const toPitch = (step: number) => key + 12 * Math.floor(step / 7) + MAJOR[((step % 7) + 7) % 7];
  // The candidate nearest `prev` inside the register, rising on a tie.
  const inRange = (step: number) => toPitch(step) >= S.melody[0] && toPitch(step) <= S.melody[1];
  const nearest = (cands: number[], prev: number) =>
    cands.filter(inRange).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev) || b - a)[0];
  const first = fit(notes[0], S.melody[0] + 2, S.melody[0] + 13);
  const steps = [7 * Math.floor((first - key) / 12) + degOf(notes[0])];
  for (const pc of notes.slice(1)) {
    const d = degOf(pc);
    const prev = steps[steps.length - 1];
    steps.push(nearest([-1, 0, 1].map((o) => 7 * (Math.floor(prev / 7) + o) + d), prev));
  }
  // The variation: the motif's diatonic inversion about its first note, moved by octaves into the register.
  let inverted = steps.map((s) => 2 * steps[0] - s);
  while (Math.max(...inverted.map(toPitch)) > S.melody[1]) inverted = inverted.map((s) => s - 7);
  while (Math.min(...inverted.map(toPitch)) < S.melody[0]) inverted = inverted.map((s) => s + 7);

  // Rhythm: one unit per motif note; the theme ends on V held to the bar's end (a half cadence), the variation on
  // V for two beats, then I to the bar's end (an authentic cadence).
  const bar = 4;
  const m = notes.length * unit;
  const themeEnd = Math.ceil((m + 2) / bar) * bar;
  const varEnd = themeEnd + Math.ceil((m + 4) / bar) * bar;

  const themeChords = harmonize(steps.map((s) => ((s % 7) + 7) % 7), [4]);
  const varChords = harmonize(inverted.map((s) => ((s % 7) + 7) % 7), [4, 0]);
  const near = (prevStep: number, root: number) => {
    const ts = tones(root);
    return nearest([-1, 0, 1].flatMap((o) => ts.map((t) => 7 * (Math.floor(prevStep / 7) + o) + t)), prevStep);
  };
  const tonicNear = (prevStep: number) => nearest([-1, 0, 1].map((o) => 7 * (Math.floor(prevStep / 7) + o)), prevStep);

  // Melody events: [step, beat, duration, chord root, section, letter index | null].
  type Ev = { step: number; beat: number; dur: number; root: number; theme: boolean; letter: number | null };
  const evs: Ev[] = [];
  steps.forEach((s, i) => evs.push({ step: s, beat: i * unit, dur: unit, root: themeChords[i], theme: true, letter: letterIdx[i] }));
  const v1 = near(steps[steps.length - 1], 4);
  evs.push({ step: v1, beat: m, dur: themeEnd - m, root: 4, theme: true, letter: null });
  inverted.forEach((s, i) => evs.push({ step: s, beat: themeEnd + i * unit, dur: unit, root: varChords[i], theme: false, letter: letterIdx[i] }));
  const v2 = near(inverted[inverted.length - 1], 4);
  evs.push({ step: v2, beat: themeEnd + m, dur: 2, root: 4, theme: false, letter: null });
  evs.push({ step: tonicNear(v2), beat: themeEnd + m + 2, dur: varEnd - (themeEnd + m + 2), root: 0, theme: false, letter: null });

  // The left hand: a bass (root, or the third when that moves by step and the root doesn't) and the chord's other two
  // tones above it, each the nearest to its last pitch, so a common tone stays put.
  const chordPcs = (root: number) => tones(root).map((d) => (key + MAJOR[d]) % 12);
  let bass: number | null = null;
  let inner: [number, number] | null = null;
  const left: { beat: number; dur: number; pitches: [number, number, number]; theme: boolean }[] = [];
  let parallels = 0;
  let prevOuter: [number, number] | null = null;
  for (const e of evs) {
    const [r, t, f] = chordPcs(e.root);
    const at = (pc: number, lo: number, hi: number) => {
      const out: number[] = [];
      for (let p = lo; p <= hi; p++) if (p % 12 === pc) out.push(p);
      return out;
    };
    const roots = at(r, S.bass[0], S.bass[1]);
    const thirds = at(t, S.bass[0], S.bass[1]);
    let b = roots[0];
    if (bass !== null) {
      b = roots.sort((x, y) => Math.abs(x - bass!) - Math.abs(y - bass!))[0];
      const third = thirds.sort((x, y) => Math.abs(x - bass!) - Math.abs(y - bass!))[0];
      if (Math.abs(b - bass) > 2 && Math.abs(third - bass) <= 2 && e.root !== 0) b = third;
    }
    const others = b % 12 === r ? [t, f] : [r, f];
    const hi = Math.min(b + 16, S.leftTop);
    const pairs: [number, number][] = [];
    for (const x of at(others[0], b + 3, hi)) for (const y of at(others[1], b + 3, hi)) if (x !== y) pairs.push(x < y ? [x, y] : [y, x]);
    const ref = inner ?? [b + 7, b + 12];
    const pair = pairs.sort((p, q) => Math.abs(p[0] - ref[0]) + Math.abs(p[1] - ref[1]) - (Math.abs(q[0] - ref[0]) + Math.abs(q[1] - ref[1])) || p[0] - q[0])[0];
    left.push({ beat: e.beat, dur: e.dur, pitches: [b, pair[0], pair[1]], theme: e.theme });
    const mel = toPitch(e.step);
    if (prevOuter) {
      const [pm, pb] = prevOuter;
      const iv = (mel - b) % 12;
      const piv = (pm - pb) % 12;
      if ((iv === 7 || iv === 0) && iv === piv && mel !== pm && b !== pb) parallels++;
    }
    prevOuter = [mel, b];
    bass = b;
    inner = pair;
  }

  // Notes, with a voice's repeated pitch across neighbouring chords held as one note.
  const out: ChartNote[] = [];
  const letterOf: Record<string, number> = {};
  evs.forEach((e, i) => {
    const id = `m${i + 1}`;
    out.push({ id, pitch: toPitch(e.step), beat: e.beat, duration: e.dur, hand: "R", velocity: e.theme ? S.velocity.themeMelody : S.velocity.variationMelody });
    if (e.letter !== null) letterOf[id] = e.letter;
  });
  for (let v = 0; v < 3; v++) {
    let held: ChartNote | null = null;
    left.forEach((l, i) => {
      const pitch = l.pitches[v];
      if (held && held.pitch === pitch && held.beat + held.duration === l.beat) {
        held.duration += l.dur;
        return;
      }
      held = { id: `l${v + 1}-${i + 1}`, pitch, beat: l.beat, duration: l.dur, hand: "L", velocity: l.theme ? S.velocity.themeChords : S.velocity.variationChords };
      out.push(held);
    });
  }
  out.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);

  // The pedal, golden-demo's per-harmony rule: down just after each new harmony, up just before the next.
  const changes = evs.filter((e, i) => i === 0 || e.root !== evs[i - 1].root).map((e) => e.beat);
  const pedal: Pedal = changes.map((b, i) => [b + S.pedalDown, (changes[i + 1] ?? varEnd) - S.pedalUp]);

  const bpm = Math.min(S.bpm[1], Math.max(S.bpm[0], Math.round((varEnd * 60) / S.targetSeconds)));
  return {
    letters,
    key,
    motif: pcs,
    chords: evs.map((e) => CHORD[e.root]),
    chart: {
      id: "name-theme",
      title: "Your Name, in Music",
      composer: "Étude's name-theme generator",
      source: "Composed in the browser from a name's letters by web/src/game/x/name-theme (rules: specs/decisions/name-theme-composition.md)",
      bpm,
      beatsPerBar: bar,
      notes: out,
    },
    pedal,
    letterOf,
    parallels,
  };
}
