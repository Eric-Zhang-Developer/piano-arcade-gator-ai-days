// The take graph's data (spec: take-graph). Pure: one point per chart note, from the chart, the take and its results.
import type { Chart, Hand, Results, Take } from "../../contracts";
import { msPerBeat } from "../core/settings";

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

// "Bar 5, beat 2 · +32 ms · GREAT · velocity 74": a dot's tooltip, accessible name and table row.
export function describePoint(p: GraphPoint, withVelocity: boolean): string {
  const at = `Bar ${p.bar}, beat ${fmtBeat(p.beat)}`;
  if (p.offsetMs === null) return `${at} · MISS`;
  const ms = `${p.offsetMs > 0 ? "+" : p.offsetMs < 0 ? "−" : "±"}${Math.abs(Math.round(p.offsetMs))} ms`;
  return [at, ms, p.judgment, ...(withVelocity && p.velocity !== null ? [`velocity ${p.velocity}`] : [])].join(" · ");
}
