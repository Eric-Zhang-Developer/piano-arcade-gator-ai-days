// The numbers behind the Duo results (spec: duo-results): per-bar accuracy, the weakest run, the timing histogram,
// the tutor's template line and "next for you". Pure; every number comes from the take.
import type { Chart, Hand, Results, Take } from "../../contracts";
import { passAccuracy } from "../bar-loop";
import { msPerBeat } from "../core/settings";
import { practiceReason } from "../records/store";
import { MIN_TIMED } from "../timing";

export const duoResultsSettings = {
  cleanAccuracy: 0.95, // a bar at or above this isn't weak; every bar clean: no weak run
  maxRunBars: 4,
  driftMs: 20, // a hand's mean offset in the run past this names that hand
  practiceTempo: 70, // percent, for PRACTICE BARS X–Y
  binMs: 10,
  rangeMs: 100, // the histogram spans −rangeMs to +rangeMs; offsets past it land in the end bins
};

export interface BarCell {
  from: number; // bar, 1-based, as bar-loop numbers bars
  to: number;
  notes: number;
  accuracy: number | null; // 0–1 by the judge's formula; null for a cell with no notes
  misses: number; // MISS judgments and WRONG presses in the cell
}

export const barCount = (chart: Chart) =>
  Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar);

// Bars from..to by weak-bars' rule: their notes, plus the WRONG presses that fall in them.
export function rangeScore(chart: Chart, take: Take, results: Results, from: number, to: number): BarCell {
  const [lo, hi] = [(from - 1) * chart.beatsPerBar, to * chart.beatsPerBar];
  const ids = new Set(chart.notes.filter((n) => n.beat >= lo && n.beat < hi).map((n) => n.id));
  const barMs = chart.beatsPerBar * msPerBeat(chart.bpm);
  const count = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 };
  for (const j of results.judgments) if (ids.has(j.noteId)) count[j.judgment]++;
  for (const w of results.wrong ?? []) {
    const t = take.events[w.eventIndex]?.timeMs;
    if (t !== undefined && t >= (from - 1) * barMs && t < to * barMs) count.wrong++;
  }
  return { from, to, notes: ids.size, accuracy: ids.size ? passAccuracy(count, ids.size) : null, misses: count.MISS + count.wrong };
}

// One cell per `per` bars from bar 1 (the strip pairs bars when one per cell gets too narrow).
export function barScores(chart: Chart, take: Take, results: Results, per = 1): BarCell[] {
  const bars = barCount(chart);
  const out: BarCell[] = [];
  for (let from = 1; from <= bars; from += per) out.push(rangeScore(chart, take, results, from, Math.min(bars, from + per - 1)));
  return out;
}

// The weakest bar (earliest on a tie), grown over neighbouring weak bars, the weaker side first, up to maxRunBars.
// An empty bar ends a run. Null when every bar is clean.
export function weakestRun(bars: BarCell[]): { from: number; to: number } | null {
  const { cleanAccuracy, maxRunBars } = duoResultsSettings;
  const weak = (i: number) => i >= 0 && i < bars.length && bars[i].accuracy !== null && bars[i].accuracy! < cleanAccuracy;
  let lo = -1;
  bars.forEach((b, i) => {
    if (weak(i) && (lo < 0 || b.accuracy! < bars[lo].accuracy!)) lo = i;
  });
  if (lo < 0) return null;
  let hi = lo;
  while (hi - lo + 1 < maxRunBars) {
    const [l, r] = [weak(lo - 1) ? bars[lo - 1].accuracy! : Infinity, weak(hi + 1) ? bars[hi + 1].accuracy! : Infinity];
    if (l === Infinity && r === Infinity) break;
    if (l <= r) lo--;
    else hi++;
  }
  return { from: bars[lo].from, to: bars[hi].to };
}

// Each hand's mean offset over the run's timed notes; null below MIN_TIMED (timing-feedback's floor).
export function handDrift(chart: Chart, results: Results, from: number, to: number): Record<Hand, number | null> {
  const [lo, hi] = [(from - 1) * chart.beatsPerBar, to * chart.beatsPerBar];
  const hand = new Map(chart.notes.filter((n) => n.beat >= lo && n.beat < hi).map((n) => [n.id, n.hand]));
  const by: Record<Hand, number[]> = { L: [], R: [] };
  for (const j of results.judgments) if (j.offsetMs !== null && hand.has(j.noteId)) by[hand.get(j.noteId)!].push(j.offsetMs);
  const mean = (xs: number[]) => (xs.length >= MIN_TIMED ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
  return { L: mean(by.L), R: mean(by.R) };
}

// Every hit's offset in binMs bins from −rangeMs to +rangeMs; the bins sum to the hits.
export function histogram(results: Results): { bins: number[]; meanMs: number | null } {
  const { binMs, rangeMs } = duoResultsSettings;
  const n = (2 * rangeMs) / binMs;
  const bins = new Array<number>(n).fill(0);
  const offsets = results.judgments.flatMap((j) => (j.offsetMs === null ? [] : [j.offsetMs]));
  for (const x of offsets) bins[Math.min(n - 1, Math.max(0, Math.floor((x + rangeMs) / binMs)))]++;
  return { bins, meanMs: offsets.length ? offsets.reduce((s, x) => s + x, 0) / offsets.length : null };
}

export function timingCaption(meanMs: number | null): string {
  if (meanMs === null) return "NO TIMED NOTES";
  const ms = Math.round(meanMs);
  return ms === 0 ? "AVG 0 MS" : ms > 0 ? `AVG +${ms} MS LATE` : `AVG −${-ms} MS EARLY`;
}

export interface TutorInput {
  run: { from: number; to: number } | null;
  accuracy: number | null; // the run's
  drift: Record<Hand, number | null>; // the run's
  misses?: number; // the run's MISS and WRONG; 0 means every note was hit, only off the beat
}

const bars = (r: { from: number; to: number }) => (r.from === r.to ? `bar ${r.from}` : `bars ${r.from}–${r.to}`);

// The hand whose mean offset is past driftMs (the larger if both), with that offset; [null, null] for neither.
export const driftingHand = (drift: Record<Hand, number | null>): [Hand, number] | [null, null] =>
  ((["L", "R"] as const)
    .map((h) => [h, drift[h]] as [Hand, number | null])
    .filter(([, d]) => d !== null && Math.abs(d) > duoResultsSettings.driftMs)
    .sort((a, b) => Math.abs(b[1]!) - Math.abs(a[1]!))[0] as [Hand, number] | undefined) ?? [null, null];

// The template line: a drifting hand if one is past driftMs, else the run's accuracy. "Accuracy", not "notes right":
// it's the judge's weighted score, so a run with no misses can still be the weakest (Eric's full combo read "54% of
// notes right" with every note hit).
export function tutorLine({ run, accuracy, drift, misses }: TutorInput): string[] {
  if (!run) return ["Clean take. Try it faster, or pick the next song."];
  const [hand, ms] = driftingHand(drift);
  const first =
    hand && ms !== null
      ? `Your ${hand === "L" ? "left" : "right"} hand ${ms > 0 ? "drags" : "rushes"} in ${bars(run)}, about ${Math.round(Math.abs(ms))} ms ${ms > 0 ? "late" : "early"}.`
      : `${bars(run).replace(/^b/, "B")} ${run.from === run.to ? "was" : "were"} your weakest: ${Math.round((accuracy ?? 0) * 100)}% accuracy${misses === 0 ? ", every note hit but off the beat" : ""}.`;
  return [first, `Let's loop just those bars at ${duoResultsSettings.practiceTempo}%, then play it through.`];
}

// bar-loop on the run at practiceTempo, keeping only the params that pick the song.
export function practiceBarsUrl(chartId: string, params: URLSearchParams, run: { from: number; to: number }): string {
  const q = new URLSearchParams({ song: params.get("song") ?? chartId });
  if (params.has("hands")) q.set("hands", params.get("hands")!);
  q.set("from", String(run.from));
  q.set("to", String(run.to));
  q.set("tempo", String(duoResultsSettings.practiceTempo));
  return `/play?${q}`;
}

export const nextForKey = (songId: string) => `pianoArcade.nextFor.${songId}`;
export interface NextFor {
  song: string;
  from: number;
  to: number;
  hand: Hand | null; // the hand the tutor named, if any
}

// "Next for you", for duo-select: only after a scored take (records' practice rule, plus demo and practice=), and
// only with a weak run. Storage that throws saves nothing.
export function saveNextFor(storage: Pick<Storage, "setItem"> | null, params: URLSearchParams, entry: NextFor | null): boolean {
  if (!entry || !storage || practiceReason(params) || params.has("demo") || params.has("practice")) return false;
  try {
    storage.setItem(nextForKey(entry.song), JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}
