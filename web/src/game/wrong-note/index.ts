// Spot the wrong note (spec: wrong-note-spike): the DGX plays 8 notes of a tune you know with one moved, and you
// say which. Pure: the round, its MIDI messages, the set as a reducer, and a just-in-time sender. The page
// (/wrong-note) does the clock and I/O.
import type { Chart, ChartNote } from "../../contracts";
import { allNotesOff, type Message } from "../piano-out";
import { phraseMessages } from "../simon";

export const wrongNoteSettings = {
  length: 8, // notes in a phrase
  rounds: 10, // rounds in a set
  shift: 2, // semitones the changed note moves, up or down
  leadMs: 400, // from a new round or Replay to the first note
  lookaheadMs: 60, // the piano gets each message this far ahead, never the whole phrase (decision wrong-note-spike-send)
  tickMs: 20,
};

export type Rng = () => number; // uniform in [0, 1)

// mulberry32: small, seedable, the same sequence everywhere, so ?seed=<n> replays a set.
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shuffled = <T>(xs: T[], rng: Rng) => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export interface Round {
  start: number; // index of the phrase's first note in the melody
  source: ChartNote[]; // the 8 notes as written
  played: ChartNote[]; // the same, one moved
  changed: number; // 1-based position of the moved note, 2–8
}

// 8 consecutive melody notes from a random start; one of notes 2–8 moves `shift` semitones up or down, never onto a
// neighbor's pitch (that would sound like a repeat, not a wrong note). A note that can't move either way is skipped
// for another. Null when the melody is shorter than a phrase or no note can move.
export function makeRound(tune: ChartNote[], rng: Rng, shift = wrongNoteSettings.shift): Round | null {
  const { length } = wrongNoteSettings;
  if (tune.length < length) return null;
  const start = Math.floor(rng() * (tune.length - length + 1));
  const source = tune.slice(start, start + length);
  for (const i of shuffled([1, 2, 3, 4, 5, 6, 7], rng)) {
    const neighbors = [source[i - 1].pitch, source[i + 1]?.pitch];
    const to = shuffled([shift, -shift], rng)
      .map((d) => source[i].pitch + d)
      .find((p) => !neighbors.includes(p));
    if (to !== undefined) return { start, source, played: source.map((n, k) => (k === i ? { ...n, pitch: to } : n)), changed: i + 1 };
  }
  return null;
}

// The round as played (or, for the reveal, as written), on channel 1 at the chart's beats and bpm, from startMs.
export const roundMessages = (chart: Chart, round: Round, startMs: number, written = false): Message[] =>
  phraseMessages(chart, written ? round.source : round.played, startMs);

export interface Answer {
  changed: number;
  answer: number;
  replays: number;
}
export interface WrongNoteSet {
  seed: number;
  shift: number;
  rounds: Round[];
  index: number; // the round being played, 0-based
  replays: number; // this round's so far
  answers: Answer[];
  phase: "ask" | "reveal" | "done";
}
export type WrongNoteEvent = { type: "replay" } | { type: "answer"; note: number } | { type: "next" };

// Ten rounds from one seed. Fewer when the melody can't make them (a too-short chart).
export function newSet(tune: ChartNote[], seed: number, shift = wrongNoteSettings.shift): WrongNoteSet {
  const rng = seeded(seed);
  const rounds: Round[] = [];
  for (let i = 0; i < wrongNoteSettings.rounds; i++) {
    const r = makeRound(tune, rng, shift);
    if (r) rounds.push(r);
  }
  return { seed, shift, rounds, index: 0, replays: 0, answers: [], phase: rounds.length ? "ask" : "done" };
}

// Replays count while you listen; an answer (notes 2–8) reveals; next moves on, and the last round ends the set.
export function step(set: WrongNoteSet, e: WrongNoteEvent): WrongNoteSet {
  if (e.type === "replay") return set.phase === "ask" ? { ...set, replays: set.replays + 1 } : set;
  if (e.type === "answer") {
    if (set.phase !== "ask" || e.note < 2 || e.note > wrongNoteSettings.length) return set;
    const answer = { changed: set.rounds[set.index].changed, answer: e.note, replays: set.replays };
    return { ...set, answers: [...set.answers, answer], phase: "reveal" };
  }
  if (set.phase !== "reveal") return set;
  return set.index + 1 < set.rounds.length ? { ...set, index: set.index + 1, replays: 0, phase: "ask" } : { ...set, phase: "done" };
}

export const score = (set: WrongNoteSet) => set.answers.filter((a) => a.answer === a.changed).length;

type Out = Pick<MIDIOutput, "send">;

// Hands the output only the messages due within lookaheadMs, from a timer. A timestamped Web MIDI message can't be
// taken back (Chrome has no MIDIOutput.clear()), so sending the whole phrase up front would let it play on over the
// next round (song-preview's bug on the DGX). stop() ends the timer, lifts every key it pressed after its note-on, and
// sends All Notes Off on every channel.
export function sendAhead(out: Out, messages: Message[]): () => void {
  const { lookaheadMs, tickMs } = wrongNoteSettings;
  const pressed: { pitch: number; atMs: number }[] = [];
  let next = 0;
  const tick = () => {
    for (; next < messages.length && messages[next].atMs <= performance.now() + lookaheadMs; next++) {
      const m = messages[next];
      out.send(m.bytes, m.atMs);
      if ((m.bytes[0] & 0xf0) === 0x90) pressed.push({ pitch: m.bytes[1], atMs: m.atMs });
    }
    if (next >= messages.length) clearInterval(timer);
  };
  const timer = setInterval(tick, tickMs);
  tick();
  return () => {
    clearInterval(timer);
    const t = Math.max(performance.now(), ...pressed.map((p) => p.atMs)) + 1;
    for (const p of pressed) out.send([0x80, p.pitch, 0], t);
    for (const m of allNotesOff(t)) out.send(m.bytes, m.atMs);
  };
}
