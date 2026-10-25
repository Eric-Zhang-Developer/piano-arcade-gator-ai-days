// Highlight reel's cut (spike: highlight-reel): which run of the take to show, and the edit list that maps each reel
// frame to a take time. Pure, so the page, the sound and the tests run the same numbers.
import type { Chart, Judgment, Results, Take } from "../../../contracts";
import { noteTimeMs } from "../../core/judge";
import { msPerBeat } from "../../core/settings";
import { replaySpan } from "../../replay-view";

// Starting values, logged in specs/decisions/highlight-reel-cut.md.
export const highlightSettings = {
  fps: 60,
  frames: 900, // 15.0 s
  titleFrames: 90, // 1.5 s
  slowFrames: 540, // the cold open, 9 s of reel; the finish gets what's left (270 frames, 4.5 s)
  rampFrames: 90, // each speed ramp, eased
  slowRate: 0.5,
};
export type HighlightSettings = typeof highlightSettings;

export interface Run {
  count: number;
  kind: "PERFECT" | "hits";
  fromMs: number; // its first and last notes' chart times
  toMs: number;
}

const HITS: Judgment[] = ["PERFECT", "GREAT", "GOOD"];

// The longest stretch of consecutive chart notes (time order, ties by pitch) all judged PERFECT, the earliest on a
// tie; with no PERFECT, the longest run of hits; with no hits, null.
export function bestRun(chart: Chart, results: Results): Run | null {
  const judged = new Map(results.judgments.map((j) => [j.noteId, j.judgment]));
  const notes = [...chart.notes].sort((a, b) => noteTimeMs(chart, a) - noteTimeMs(chart, b) || a.pitch - b.pitch);
  const longest = (ok: (j: Judgment | undefined) => boolean) => {
    let best: [number, number] | null = null;
    for (let i = 0; i < notes.length; ) {
      if (!ok(judged.get(notes[i].id))) {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < notes.length && ok(judged.get(notes[j + 1].id))) j++;
      if (!best || j - i > best[1] - best[0]) best = [i, j];
      i = j + 1;
    }
    return best;
  };
  const perfect = longest((j) => j === "PERFECT");
  const span = perfect ?? longest((j) => j !== undefined && HITS.includes(j));
  if (!span) return null;
  const [a, b] = span;
  return { count: b - a + 1, kind: perfect ? "PERFECT" : "hits", fromMs: noteTimeMs(chart, notes[a]), toMs: noteTimeMs(chart, notes[b]) };
}

export interface Segment {
  kind: "slow" | "finish" | "title";
  fromFrame: number;
  frames: number;
  srcFromMs: number; // take time at the segment's first frame (the title card holds the finish's last)
  srcToMs: number;
}
export interface Edl {
  run: Run;
  segments: [Segment, Segment, Segment];
}

const smooth = (u: number) => u * u * (3 - 2 * u);
const smoothInt = (u: number) => u ** 3 - u ** 4 / 2; // ∫0^u smooth

// The cold open's playback rate at reel frame f of the segment: 1 → slowRate over a ramp, held, then back to 1.
export function slowRateAt(f: number, s: HighlightSettings = highlightSettings): number {
  const { rampFrames: R, slowFrames: F, slowRate: r } = s;
  if (f < R) return 1 - (1 - r) * smooth(Math.max(0, f) / R);
  if (f < F - R) return r;
  return r + (1 - r) * smooth(Math.min(1, (f - (F - R)) / R));
}

// Source frames played after f reel frames of the cold open: the integral of slowRateAt.
export function slowSourceFrames(f: number, s: HighlightSettings = highlightSettings): number {
  const { rampFrames: R, slowFrames: F, slowRate: r } = s;
  const x = Math.min(Math.max(f, 0), F);
  const down = (u: number) => R * (u - (1 - r) * smoothInt(u));
  const up = (u: number) => R * (r * u + (1 - r) * smoothInt(u));
  if (x <= R) return down(x / R);
  const hold = F - 2 * R;
  if (x <= R + hold) return down(1) + r * (x - R);
  return down(1) + r * hold + up((x - R - hold) / R);
}

const frameMs = (s: HighlightSettings) => 1000 / s.fps;

// The edit list, or null when the take has no hits. The finish ends a beat after the last release; the cold open
// shows the best run's middle, padded to a beat each side, and more when the run is too short to fill it, but never
// from more than a beat before the first press; it ends before the finish starts, taking the run's earlier part when
// the run reaches the finish.
export function cut(chart: Chart, take: Take, results: Results, s: HighlightSettings = highlightSettings): Edl | null {
  const run = bestRun(chart, results);
  if (!run || !take.events.some((e) => e.velocity > 0)) return null;
  const beat = msPerBeat(chart.bpm);
  const span = replaySpan(chart, take);
  const finishFrames = s.frames - s.titleFrames - s.slowFrames;
  const finishMs = finishFrames * frameMs(s);
  const slowMs = slowSourceFrames(s.slowFrames, s) * frameMs(s);

  const end = span.toMs - span.barMs + beat; // a beat after the last release
  let f0 = end - finishMs;
  const [lo, hi] = [run.fromMs - beat, run.toMs + beat];
  let s0 = (lo + hi) / 2 - slowMs / 2; // the middle; a short run is padded evenly past its beat
  if (hi - lo >= slowMs) s0 = Math.max(lo, Math.min(s0, hi - slowMs));
  s0 = Math.max(s0, span.firstPressMs - beat); // never open on the empty highway before the take
  if (s0 + slowMs > f0) s0 = f0 - slowMs; // the run reaches the finish: its earlier part
  if (f0 < s0 + slowMs) f0 = s0 + slowMs; // a take too short for both: the finish runs on past the end

  const slow: Segment = { kind: "slow", fromFrame: 0, frames: s.slowFrames, srcFromMs: s0, srcToMs: s0 + slowMs };
  const finish: Segment = { kind: "finish", fromFrame: s.slowFrames, frames: finishFrames, srcFromMs: f0, srcToMs: f0 + finishMs };
  const title: Segment = { kind: "title", fromFrame: s.frames - s.titleFrames, frames: s.titleFrames, srcFromMs: f0 + finishMs, srcToMs: f0 + finishMs };
  return { run, segments: [slow, finish, title] };
}

export const segmentAt = (edl: Edl, frame: number): Segment =>
  edl.segments.find((g) => frame >= g.fromFrame && frame < g.fromFrame + g.frames) ?? edl.segments[2];

// The take time shown at reel frame n (fractional frames allowed).
export function takeTimeAt(edl: Edl, n: number, s: HighlightSettings = highlightSettings): number {
  const g = segmentAt(edl, n);
  const f = n - g.fromFrame;
  if (g.kind === "slow") return g.srcFromMs + slowSourceFrames(f, s) * frameMs(s);
  if (g.kind === "finish") return g.srcFromMs + f * frameMs(s);
  return g.srcToMs;
}

// The reel time (ms) a take time plays at, or null when no segment shows it.
export function reelMsOf(edl: Edl, takeMs: number, s: HighlightSettings = highlightSettings): number | null {
  const [slow, finish] = edl.segments;
  if (takeMs >= finish.srcFromMs && takeMs < finish.srcToMs) return (finish.fromFrame + (takeMs - finish.srcFromMs) / frameMs(s)) * frameMs(s);
  if (takeMs < slow.srcFromMs || takeMs >= slow.srcToMs) return null;
  const want = (takeMs - slow.srcFromMs) / frameMs(s);
  let [a, b] = [0, slow.frames];
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (slowSourceFrames(m, s) < want) a = m;
    else b = m;
  }
  return ((a + b) / 2) * frameMs(s);
}

// Every press of the take, at its reel time, in order: what the sound should have an onset at.
export const expectedOnsetsMs = (edl: Edl, take: Take, s: HighlightSettings = highlightSettings): number[] =>
  take.events
    .filter((e) => e.velocity > 0)
    .map((e) => reelMsOf(edl, e.timeMs, s))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
