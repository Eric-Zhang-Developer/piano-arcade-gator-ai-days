// Timing feedback: how early or late a take was, from its Take and Results (spec: timing-feedback). Pure.
import type { Chart, Results, Take } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { LATENCY_MAX, LATENCY_MIN, NEAR_MISS_MS, timingWindows } from "../core/settings";

// A near miss: a MISS note with a same-pitch press within NEAR_MISS_MS (150 ms, osu!'s outermost window at OD 5).
// Since judging-tiers, a press within GOOD_MS (100 ms) is a GOOD hit, so near misses lie between 100 and 150 ms.
export const MIN_TIMED = 3; // fewer timed presses: no numbers
export const MIN_TIMED_FOR_SUGGESTION = 10;
export const SUGGEST_FROM_MS = 10; // |mean| at least this before suggesting a latency change

export interface TimingSummary {
  nearMissWindowMs?: number;
  timed: number; // hits plus near misses
  meanMs: number | null; // signed, negative is early; null below MIN_TIMED
  sdMs: number | null;
  early: number;
  late: number;
  misses: number;
  nearMisses: number;
  suggestedLatencyMs: number | null;
}

export function timingSummary(chart: Chart, take: Take, results: Results, currentLatencyMs: number): TimingSummary {
  const nearWindow = timingWindows(take.scoringVersion).nearMiss;
  const notes = new Map(chart.notes.map((n) => [n.id, n]));
  const offsets = results.judgments.flatMap((j) => (j.offsetMs === null ? [] : [j.offsetMs]));

  // Near misses: pair each MISS note with the nearest same-pitch extra within NEAR_MISS_MS, one-to-one.
  const missed = results.judgments.filter((j) => j.judgment === "MISS").map((j) => notes.get(j.noteId)!);
  const pairs = missed.flatMap((n) =>
    results.extras.flatMap(({ eventIndex }) => {
      const e = take.events[eventIndex];
      const d = e.timeMs - noteTimeMs(chart, n);
      return e.pitch === n.pitch && Math.abs(d) <= nearWindow ? [{ noteId: n.id, eventIndex, d }] : [];
    }),
  );
  pairs.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  const usedNotes = new Set<string>();
  const usedEvents = new Set<number>();
  const near: number[] = [];
  for (const p of pairs) {
    if (usedNotes.has(p.noteId) || usedEvents.has(p.eventIndex)) continue;
    usedNotes.add(p.noteId);
    usedEvents.add(p.eventIndex);
    near.push(p.d);
  }

  const all = [...offsets, ...near];
  const enough = all.length >= MIN_TIMED;
  const mean = all.reduce((s, x) => s + x, 0) / (all.length || 1);
  const sd = Math.sqrt(all.reduce((s, x) => s + (x - mean) ** 2, 0) / (all.length || 1));
  const suggest = all.length >= MIN_TIMED_FOR_SUGGESTION && Math.abs(mean) >= SUGGEST_FROM_MS;
  const round = (x: number) => Math.round(x) + 0; // + 0 turns -0 into 0
  return {
    ...(take.scoringVersion === 3 ? { nearMissWindowMs: nearWindow } : {}),
    timed: all.length,
    meanMs: enough ? round(mean) : null,
    sdMs: enough ? round(sd) : null,
    // Counted at the precision the mean is shown in, so sub-ms clock noise on a perfect press counts as neither.
    early: all.filter((x) => round(x) < 0).length,
    late: all.filter((x) => round(x) > 0).length,
    misses: missed.length,
    nearMisses: near.length,
    suggestedLatencyMs: suggest ? Math.min(LATENCY_MAX, Math.max(LATENCY_MIN, round(currentLatencyMs + mean))) : null,
  };
}

// The results screen's lines, in words.
export function describeTiming(s: TimingSummary): string[] {
  if (s.meanMs === null || s.sdMs === null) return ["Not enough timed presses"];
  const avg =
    s.meanMs === 0 ? "On time on average" : `${s.meanMs > 0 ? "Late" : "Early"} by ${Math.abs(s.meanMs)} ms on average`;
  const lines = [`${avg}, spread ±${s.sdMs} ms`, `${s.early} early · ${s.late} late`];
  if (s.misses > 0)
    lines.push(
      `${s.nearMisses} of ${s.misses} ${s.misses === 1 ? "miss was" : "misses were"} within ${s.nearMissWindowMs ?? NEAR_MISS_MS} ms`,
    );
  return lines;
}
