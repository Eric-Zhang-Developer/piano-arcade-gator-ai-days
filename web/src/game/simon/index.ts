// Simon Says (spec: simon-says-spike): the DGX plays a song's opening, you repeat it, and each round adds a note.
// Pure: the melody, the phrase as MIDI messages, and the run as a reducer. The page (/simon) does the clock and I/O.
import type { Chart, ChartNote } from "../../contracts";
import { keyMap } from "../core/input";
import { noteTimeMs } from "../core/judge";
import { msPerBeat } from "../core/settings";
import type { Message } from "../piano-out";

export const simonSettings = {
  turnGapMs: 300, // from the phrase's last note-off to "Your turn"
  nextRoundMs: 800, // from a clean repeat to the next phrase
  leadMs: 400, // from Start or Again to the first note
  velocity: 80,
};

// The right hand's top note at each onset, in beat order. The left hand is ignored.
export function melody(chart: Chart): ChartNote[] {
  const top = new Map<number, ChartNote>();
  for (const n of chart.notes) {
    if (n.hand !== "R") continue;
    const at = top.get(n.beat);
    if (!at || n.pitch > at.pitch) top.set(n.beat, n);
  }
  return [...top.values()].sort((a, b) => a.beat - b.beat);
}

// Round k plays the first k + 1 notes (round 1 is 2 notes).
export const phrase = (tune: ChartNote[], round: number) => tune.slice(0, round + 1);

// Note-on and note-off on channel 1 at the chart's own rhythm and tempo, the first note at startMs.
export function phraseMessages(chart: Chart, notes: ChartNote[], startMs: number): Message[] {
  if (!notes.length) return [];
  const t0 = noteTimeMs(chart, notes[0]);
  const out: Message[] = [];
  for (const n of notes) {
    const on = startMs + noteTimeMs(chart, n) - t0;
    out.push({ bytes: [0x90, n.pitch, simonSettings.velocity], atMs: on }, { bytes: [0x80, n.pitch, 0], atMs: on + n.duration * msPerBeat(chart.bpm) });
  }
  // At equal times a release goes first, so Twinkle's repeated notes sound twice (as piano-out does).
  return out.sort((a, b) => a.atMs - b.atMs || (a.bytes[0] === 0x80 ? -1 : 0) - (b.bytes[0] === 0x80 ? -1 : 0));
}

export type Phase = "listen" | "turn" | "over" | "won";
export interface Run {
  round: number; // the round being played, or the one reached when the run is over
  pos: number; // notes repeated so far this round
  phase: Phase;
  wrong: number | null; // the pitch that ended the run
}
export type SimonEvent = { type: "turn" } | { type: "on"; pitch: number } | { type: "off" };

export const newRun = (): Run => ({ round: 1, pos: 0, phase: "listen", wrong: null });

// A note-on during your turn is right only at the next note's exact pitch. Releases, presses while the phrase plays,
// and any gap between presses change nothing: Simon tests the order, not the rhythm.
export function step(run: Run, e: SimonEvent, tune: ChartNote[]): Run {
  if (e.type === "turn") return run.phase === "listen" ? { ...run, phase: "turn", pos: 0 } : run;
  if (e.type !== "on" || run.phase !== "turn") return run;
  const want = phrase(tune, run.round);
  if (e.pitch !== want[run.pos].pitch) return { ...run, phase: "over", wrong: e.pitch };
  if (run.pos + 1 < want.length) return { ...run, pos: run.pos + 1 };
  if (want.length >= tune.length) return { ...run, pos: run.pos + 1, phase: "won" };
  return { round: run.round + 1, pos: 0, phase: "listen", wrong: null };
}

// The last round whose whole phrase the laptop row (10 white keys from the melody's lowest note) can play, or null
// when it covers the whole melody.
export function laptopReach(tune: ChartNote[]): number | null {
  if (!tune.length) return null;
  const pitches = new Set(keyMap(Math.min(...tune.map((n) => n.pitch))).values());
  const first = tune.findIndex((n) => !pitches.has(n.pitch));
  return first < 0 ? null : Math.max(0, first - 1);
}
