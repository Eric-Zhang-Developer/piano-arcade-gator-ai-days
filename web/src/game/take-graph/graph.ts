// The take graph's data (spec: take-graph). Pure: one point per chart note, from the chart, the take and its results.
import type { Chart, Hand, Results, Take } from "../../contracts";
import { GOOD_MS, GREAT_MS, PERFECT_MS, msPerBeat } from "../core/settings";
import { weakBarsSettings } from "../weak-bars";

export interface GraphPoint {
  noteId: string;
  x: number; // chart time in bars from the start: bar 1 beat 1 is 0
  bar: number; // 1-based
  beat: number; // 1-based within the bar; fractional for off-beat notes
  hand: Hand;
  judgment: "PERFECT" | "GREAT" | "GOOD" | "MISS";
  offsetMs: number | null; // signed, late is positive; null for a MISS
  velocity: number | null; // the played key's, from take.events; null for a MISS
}

export function barAndBeat(chartBeat: number, beatsPerBar: number): { bar: number; beat: number } {
  return { bar: Math.floor(chartBeat / beatsPerBar) + 1, beat: (chartBeat % beatsPerBar) + 1 };
}

// results.judgments is in chart order (the judge keeps one per chart note), so judgments[i] is notes[i]'s.
export function graphPoints(chart: Chart, take: Take, results: Results): GraphPoint[] {
  return chart.notes.map((n, i) => {
    const j = results.judgments[i];
    const ev = j.eventIndex === null ? null : take.events[j.eventIndex];
    return {
      noteId: n.id,
      x: n.beat / chart.beatsPerBar,
      ...barAndBeat(n.beat, chart.beatsPerBar),
      hand: n.hand,
      judgment: j.judgment,
      offsetMs: j.offsetMs,
      velocity: ev?.velocity ?? null,
    };
  });
}

// WRONG notes, placed by their time, in bars.
export function wrongMarks(chart: Chart, take: Take, results: Results): number[] {
  const barMs = msPerBeat(chart.bpm) * chart.beatsPerBar;
  return (results.wrong ?? []).map((w) => take.events[w.eventIndex].timeMs / barMs);
}

// Only MIDI and the test input sense velocity; laptop keys always send the same value.
export const sensesVelocity = (take: Take) => take.inputDevice !== "keys";

const fmtBeat = (b: number) => String(Math.round(b * 100) / 100);
export const fmtMs = (ms: number) => {
  const r = Math.round(ms);
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)} ms`;
};

// "Bar 12 · beat 3 · +32 ms · GREAT · vel 74": the readout card, and the graph's name while a note is focused. The
// offset is the judge's, never the plot's clipped one.
export function describePoint(p: GraphPoint, withVelocity: boolean): string {
  const at = `Bar ${p.bar} · beat ${fmtBeat(p.beat)}`;
  if (p.offsetMs === null) return `${at} · MISS`;
  return [at, fmtMs(p.offsetMs), p.judgment, ...(withVelocity && p.velocity !== null ? [`vel ${p.velocity}`] : [])].join(" · ");
}

export interface Windows {
  perfect: number;
  great: number;
  good: number;
}
// The judge's windows (core/settings): the bands come from these, so the graph moves with the judge.
export const judgeWindows: Windows = { perfect: PERFECT_MS, great: GREAT_MS, good: GOOD_MS };

// The shaded bands, widest first, each ±ms around zero.
export function bands(w: Windows = judgeWindows): { judgment: "GOOD" | "GREAT" | "PERFECT"; ms: number }[] {
  return [
    { judgment: "GOOD", ms: w.good },
    { judgment: "GREAT", ms: w.great },
    { judgment: "PERFECT", ms: w.perfect },
  ];
}

// Where an offset draws: inside ±good as is, past it pinned to the edge and marked, so nothing past GOOD reads as GOOD.
export function clipOffset(ms: number, w: Windows = judgeWindows): { ms: number; clipped: boolean } {
  return Math.abs(ms) > w.good ? { ms: Math.sign(ms) * w.good, clipped: true } : { ms, clipped: false };
}

export const graphSettings = {
  medianNotes: 8, // the rolling median's window, in one hand's hits (decision take-graph-pass-choices)
  labelPx: 36, // the least room a bar number gets on the x axis
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// One hand's trend: the median offset of each run of n consecutive hits, at the run's middle. A hand with fewer than
// n hits has none. Misses aren't hits: they carry no offset.
export function rollingMedian(points: GraphPoint[], hand: GraphPoint["hand"], n = graphSettings.medianNotes): { x: number; ms: number }[] {
  const hits = points.filter((p) => p.hand === hand && p.offsetMs !== null).sort((a, b) => a.x - b.x);
  if (hits.length < n) return [];
  return Array.from({ length: hits.length - n + 1 }, (_, i) => {
    const run = hits.slice(i, i + n);
    return { x: (run[(n - 1) >> 1].x + run[n >> 1].x) / 2, ms: median(run.map((p) => p.offsetMs!)) };
  });
}

// "RH +12 ms late", from the last window's median; null without a trend.
export function trendLabel(trend: { ms: number }[], hand: GraphPoint["hand"]): string | null {
  if (!trend.length) return null;
  const ms = trend[trend.length - 1].ms;
  const word = Math.round(ms) > 0 ? " late" : Math.round(ms) < 0 ? " early" : " on time";
  return `${hand === "R" ? "RH" : "LH"} ${fmtMs(ms)}${word}`;
}

// The x axis: a gridline at every bar line, and a number at a phrase start (weak-bars) or every 4 bars, whichever is
// sparser, then doubled until each number has labelPx of room at this plot width.
export function barTicks(bars: number, plotPx: number): { lines: number[]; labels: { at: number; bar: number }[] } {
  let step = Math.max(weakBarsSettings.phraseBars, 4);
  while ((plotPx / bars) * step < graphSettings.labelPx && step < bars) step *= 2;
  const lines = Array.from({ length: bars + 1 }, (_, b) => b);
  const labels = lines.filter((b) => b < bars && b % step === 0).map((b) => ({ at: b, bar: b + 1 }));
  return { lines, labels };
}

// The velocity strip: each hit with a sensed velocity, in time order.
export function velocityStrip(points: GraphPoint[]): { x: number; hand: GraphPoint["hand"]; velocity: number }[] {
  return points
    .filter((p) => p.offsetMs !== null && p.velocity !== null)
    .map((p) => ({ x: p.x, hand: p.hand, velocity: p.velocity! }))
    .sort((a, b) => a.x - b.x);
}

// The readout's order: every note by time, the right hand first in a chord. Arrow keys step it, Home and End jump.
export function timeOrder(points: GraphPoint[]): number[] {
  return points.map((_, i) => i).sort((a, b) => points[a].x - points[b].x || (points[a].hand === "R" ? -1 : 1) - (points[b].hand === "R" ? -1 : 1));
}

export function stepTo(order: number[], current: number | null, key: string): number | null {
  if (!order.length) return null;
  const at = current === null ? -1 : order.indexOf(current);
  if (key === "Home") return order[0];
  if (key === "End") return order[order.length - 1];
  if (key === "ArrowRight") return order[Math.min(order.length - 1, at + 1)];
  if (key === "ArrowLeft") return order[Math.max(0, at < 0 ? 0 : at - 1)];
  return current;
}
