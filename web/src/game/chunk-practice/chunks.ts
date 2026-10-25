// Chunk practice's logic (spec: chunk-practice). Pure, so it tests without a page.
import type { Chart } from "../../contracts";
import { handsSetting, splitHands } from "../hand-mode/hands";
import { lastBar } from "../song-preview/opening";
import { inMode, playMode } from "../play-modes/modes";

// Starting values, not findings: Eric tunes them on the piano.
export const chunkSettings = { bars: 4, tempo: 70, passAccuracy: 0.85 };

export interface Chunk {
  from: number; // 1-based bars, inclusive, as bar-loop reads them
  to: number;
}
export type Step = "learn" | "play";

// Bars 1–4, 5–8, … to the chart's last bar. A chunk where none of the played hand's notes starts is skipped: bar-loop
// rejects a range with no notes, and hand-mode would leave it empty.
export function chunksOf(chart: Chart, hands: string | null): Chunk[] {
  const played = splitHands(chart, handsSetting(hands)).judged.notes;
  const bpb = chart.beatsPerBar;
  const last = lastBar(chart);
  const out: Chunk[] = [];
  for (let from = 1; from <= last; from += chunkSettings.bars) {
    const to = Math.min(from + chunkSettings.bars - 1, last);
    if (played.some((n) => n.beat >= (from - 1) * bpb && n.beat < to * bpb)) out.push({ from, to });
  }
  return out;
}

// A step's URL keeps every other param (song, hands). Learn is the Learn mode at the same tempo, so the ladder's Flow
// step on its results (which changes only the mode) lands on the play step. The play step is in the take's mode,
// Flow after a Learn step (play-modes).
export function stepUrl(params: URLSearchParams, c: Chunk, step: Step): string {
  const q = new URLSearchParams(params);
  q.set("from", String(c.from));
  q.set("to", String(c.to));
  q.set("tempo", String(chunkSettings.tempo));
  q.set("passes", "1");
  const now = playMode(params);
  const out = inMode(q, step === "learn" ? "learn" : now === "learn" ? "flow" : now);
  out.set("practice", "1");
  return `/play?${out}`;
}

export function wholeSongUrl(params: URLSearchParams): string {
  const q = new URLSearchParams();
  for (const k of ["song", "hands"]) {
    const v = params.get(k);
    if (v !== null) q.set(k, v);
  }
  return `/play?${q}`;
}

// A plain take, Perform or Flow: the start screen offers the way in, in that mode (play-modes).
export const isPlainTake = (params: URLSearchParams) => !["from", "to", "practice"].some((k) => params.has(k)) && playMode(params) !== "learn";

// Which chunk and step this URL is, or null when it isn't a practice step (no practice=1, or bars that aren't a chunk).
export function practiceStep(params: URLSearchParams, list: Chunk[]): { index: number; step: Step } | null {
  if (params.get("practice") !== "1") return null;
  const index = list.findIndex((c) => String(c.from) === params.get("from") && String(c.to) === params.get("to"));
  if (index < 0) return null;
  return { index, step: params.get("mode") === "wait" ? "learn" : "play" };
}

// Where a play step leads: the next chunk's learn step, the whole song after the last chunk, or nowhere below the gate.
export function nextAfter(list: Chunk[], index: number, accuracy: number): { next: Chunk } | { whole: true } | null {
  if (!(accuracy >= chunkSettings.passAccuracy)) return null;
  return index + 1 < list.length ? { next: list[index + 1] } : { whole: true };
}

export const barsLabel = (c: Chunk) => (c.from === c.to ? `bar ${c.from}` : `bars ${c.from}–${c.to}`);
