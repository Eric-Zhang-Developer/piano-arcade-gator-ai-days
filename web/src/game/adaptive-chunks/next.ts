// Adaptive chunks' window rule (spec: adaptive-chunks). Pure: practice starts on the whole song, shrinks onto the
// phrases a player misses, and grows back as they pass, a binary search on the window's length. The units are
// weak-bars' 2-bar phrases.
import type { Chart } from "../../contracts";
import { handsSetting, splitHands } from "../hand-mode/hands";
import { phrases, type Phrase, type PhraseScore } from "../weak-bars";

// Starting values, not findings: Eric tunes them on the piano.
export const adaptSettings = { passAccuracy: 0.85, cleanToGrow: 2, tempo: 70, slowTempo: 50 };

export interface AdaptState {
  from: number; // the window, as indexes into the song's playable phrases, inclusive
  to: number;
  ok: number; // the longest length, in phrases, that passed cleanToGrow times; 0 before any
  ko: number; // the shortest length that failed since then; 0 for none
  clean: number; // clean passes in a row at this window
}

// One take, in the song's terms: its accuracy, and each phrase it covered.
export interface TakeResult {
  accuracy: number;
  phrases: { from: number; accuracy: number; notes: number }[]; // `from` is the song's bar
}

// again: a pass short of cleanToGrow. grow: the length passed. smaller: a fail before anything passed, halved.
// back: a fail after growing, to the length that passed. floor: a fail at one phrase. done: the whole song passed.
export type Step = "again" | "grow" | "smaller" | "back" | "floor" | "done";

// The song's playable phrases: weak-bars' phrases of the notes the player plays (hand-mode), so a phrase with none of
// the played hand's notes is skipped and is never a window's edge.
export const songPhrases = (chart: Chart, hands: string | null): Phrase[] => phrases(splitHands(chart, handsSetting(hands)).judged);

export const start = (list: Phrase[]): AdaptState => ({ from: 0, to: list.length - 1, ok: 0, ko: 0, clean: 0 });

// n phrases from `from`, growing forward; once the window reaches the song's end, it reaches back instead.
const place = (total: number, from: number, n: number) => {
  const f = Math.max(0, Math.min(from, total - n));
  return { from: f, to: f + n - 1 };
};

export function next(list: Phrase[], s: AdaptState, r: TakeResult): { step: Step; state: AdaptState } {
  const n = s.to - s.from + 1;
  const total = list.length;
  if (r.accuracy >= adaptSettings.passAccuracy) {
    const clean = s.clean + 1;
    if (clean < adaptSettings.cleanToGrow) return { step: "again", state: { ...s, clean } };
    const ok = n;
    const ko = s.ko && ok >= s.ko ? 0 : s.ko;
    if (n === total) return { step: "done", state: { ...s, ok, ko, clean: 0 } };
    const grown = Math.min(total, ko ? ok + Math.ceil((ko - ok) / 2) : 2 * ok);
    return { step: "grow", state: { ...place(total, s.from, grown), ok, ko, clean: 0 } };
  }
  // A fail after growing: back to the length that passed, at the window's start, so the next grow is half as big.
  if (s.ok && n > s.ok) return { step: "back", state: { from: s.from, to: s.from + s.ok - 1, ok: s.ok, ko: n, clean: 0 } };
  // Nothing has passed at this length (decision adaptive-chunks-refail): stay at one phrase, or halve onto the half
  // with more missed notes, the earlier one on a tie.
  if (n === 1) return { step: "floor", state: { ...s, ko: 1, clean: 0 } };
  const half = Math.ceil(n / 2);
  const missed = (from: number) =>
    list.slice(from, from + half).reduce((sum, p) => {
      const got = r.phrases.find((x) => x.from === p.from);
      return sum + (got ? (1 - got.accuracy) * got.notes : 0);
    }, 0);
  const late = s.to - half + 1;
  const from = missed(late) > missed(s.from) ? late : s.from;
  return { step: "smaller", state: { from, to: from + half - 1, ok: 0, ko: n, clean: 0 } };
}

// A take's result in the song's phrases. scorePhrases on bar-loop's looped chart numbers its bars from 1; a window
// starts on a phrase (an odd bar), so each of the loop's phrases is the song's, moved by the window's first bar.
export const takeResult = (accuracy: number, scores: PhraseScore[], fromBar: number): TakeResult => ({
  accuracy,
  phrases: scores.map((p) => ({ from: p.from + fromBar - 1, accuracy: p.accuracy, notes: p.noteIds.length })),
});

// A step's /play URL: bar-loop's bars, tempo and one pass, and the state. Every other param (song, hands) is kept.
export function adaptUrl(params: URLSearchParams, list: Phrase[], s: AdaptState, tempo = adaptSettings.tempo): string {
  const q = new URLSearchParams(params);
  q.set("from", String(list[s.from].from));
  q.set("to", String(list[s.to].to));
  q.set("tempo", String(tempo));
  q.set("passes", "1");
  q.delete("mode");
  q.set("practice", "adapt");
  q.set("ok", String(s.ok));
  q.set("ko", String(s.ko));
  q.set("clean", String(s.clean));
  return `/play?${q}`;
}

const int = (v: string | null) => (v !== null && /^\d+$/.test(v) ? Number(v) : NaN);

// The state an adaptive step's URL holds; null for any other URL, or bars that aren't the edges of playable phrases.
export function adaptState(params: URLSearchParams, list: Phrase[]): AdaptState | null {
  if (params.get("practice") !== "adapt") return null;
  const from = list.findIndex((p) => String(p.from) === params.get("from"));
  const to = list.findIndex((p) => String(p.to) === params.get("to"));
  const [ok, ko, clean] = ["ok", "ko", "clean"].map((k) => int(params.get(k)));
  if (from < 0 || to < from || ![ok, ko, clean].every(Number.isInteger)) return null;
  return { from, to, ok, ko, clean };
}
