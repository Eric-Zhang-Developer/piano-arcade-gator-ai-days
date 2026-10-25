// The played title (spec: video-cards): Étude's letters land one per note of a motif that spells the name in the 1909
// French cipher (name-theme's FRENCH, sources in specs/decisions/name-theme-cipher.md): E–F–G–D–E. The É's acute
// lands last, on the final note, with a burst; the tagline arrives on the next downbeat; the frame is still from
// `stillMs`. This table is the only timing (decision video-cards-motif).
import { APP_NAME } from "../app-name";
import { FRENCH } from "../x/name-theme/cipher";
import { fold, motif } from "../x/name-theme/compose";

export const titleSettings = {
  startMs: 450, // black before the first note: the cut in
  beatMs: 600, // 100 bpm
  beats: [0, 0.5, 1, 1.5, 2.5], // four quavers up to the D, then the E a crotchet later: the resolution
  firstPitch: 64, // E4; each next note is the nearest pitch of its class
  velocity: 88,
  noteMs: 520, // each note's length
  taglineBeat: 4, // the next downbeat after the last note
  riseMs: 400, // the tagline's entrance
  stillAfterMs: 300, // the frame is dead still this long after the tagline lands: the cut point
};

// The motif's pitch classes, from the cipher, and in a register: the nearest pitch to the one before.
export const motifClasses = () => motif(fold(APP_NAME), FRENCH);
export function motifPitches(s = titleSettings): number[] {
  const out: number[] = [];
  for (const pc of motifClasses()) {
    const prev = out.at(-1) ?? s.firstPitch;
    const base = prev - (((prev % 12) - pc + 12) % 12); // the pitch of this class at or below prev
    out.push(out.length === 0 ? base : prev - base <= 6 ? base : base + 12);
  }
  return out;
}

export interface TitleTimes {
  notes: { pitch: number; atMs: number }[]; // from the card's start
  accentMs: number;
  taglineMs: number;
  stillMs: number; // from here the frame doesn't change: the cut point
}

export function titleTimes(s = titleSettings): TitleTimes {
  const at = (beat: number) => s.startMs + beat * s.beatMs;
  const notes = motifPitches(s).map((pitch, i) => ({ pitch, atMs: at(s.beats[i]) }));
  const taglineMs = at(s.taglineBeat);
  return { notes, accentMs: notes.at(-1)!.atMs, taglineMs, stillMs: taglineMs + s.riseMs + s.stillAfterMs };
}

// The letters as set: the name with its accent split off, so the acute can land on its own.
export const titleLetters = () => [...APP_NAME.normalize("NFD").replace(/\p{M}/gu, "")];
