// Tempo curve (spec: tempo-curve): after a take, a second score judged against a smooth tempo curve fitted to the
// playing, so rubato isn't punished. Pure and post-take; the strict results, rank and records never change.
import { createElement } from "react";
import type { Chart, GamePlugin, Judgment, Results, Take } from "../../contracts";
import { passAccuracy } from "../bar-loop";
import { noteTimeMs } from "../core/judge";
import { GOOD_MS, GREAT_MS, msPerBeat, PERFECT_MS } from "../core/settings";

export const tempoCurveSettings = {
  windowBars: 2, // the local fit reaches this many bars each side; wider bends less (spec: prefer wider)
  matchMs: 400, // an unmatched note takes the nearest unmatched press of its pitch this close to the curve
  minTempo: 0.5, // local tempo is clamped to this share of the chart's bpm …
  maxTempo: 1.5, // … and this
  minHits: 8, // strict hits needed to fit a curve
};

export interface TempoCurve {
  at(chartMs: number): number; // played time at this chart time
  tempo(chartMs: number): number; // local tempo as a share of the chart's bpm
}

type Point = { t: number; p: number }; // chart time, played time

// A local linear fit of played against chart time, weighted by a triangle reaching windowMs each side, its slope
// clamped so the tempo stays within minTempo–maxTempo. The weighting keeps a smooth slowdown inside PERFECT, where an
// unweighted fit's error near a curve's bend runs to about 27 ms.
export function fitCurve(points: Point[], windowMs: number): TempoCurve {
  const s = tempoCurveSettings;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const local = (t: number) => {
    let [sw, st, sp, stt, stp] = [0, 0, 0, 0, 0];
    for (const q of sorted) {
      const w = 1 - Math.abs(q.t - t) / windowMs;
      if (w <= 0) continue;
      [sw, st, sp, stt, stp] = [sw + w, st + w * q.t, sp + w * q.p, stt + w * q.t * q.t, stp + w * q.t * q.p];
    }
    if (!sw) {
      // Nothing in reach: carry the nearest point's offset at the chart's tempo.
      const near = sorted.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      return { slope: 1, at: t + near.p - near.t };
    }
    const [mt, mp] = [st / sw, sp / sw];
    const varT = stt / sw - mt * mt;
    const raw = varT > 1e-6 ? (stp / sw - mt * mp) / varT : 1;
    const slope = Math.min(1 / s.minTempo, Math.max(1 / s.maxTempo, raw)); // played ms per chart ms
    return { slope, at: mp + slope * (t - mt) };
  };
  return { at: (t) => local(t).at, tempo: (t) => 1 / local(t).slope };
}

export interface Rubato {
  enough: boolean; // false: under minHits strict hits
  accuracy: number; // 0–1, Results' formula, WRONG notes included
  strict: number;
  counts: Record<Judgment, number>;
  bpmRange: [number, number] | null;
  recovered: number; // strict MISS that rubato judging hits
  judgments: { noteId: string; judgment: Judgment; offsetMs: number | null }[];
}

const judge = (offset: number): Judgment =>
  Math.abs(offset) <= PERFECT_MS ? "PERFECT" : Math.abs(offset) <= GREAT_MS ? "GREAT" : Math.abs(offset) <= GOOD_MS ? "GOOD" : "MISS";

export function rubato(chart: Chart, take: Take, results: Results): Rubato {
  const s = tempoCurveSettings;
  const windowMs = s.windowBars * chart.beatsPerBar * msPerBeat(chart.bpm);
  const notes = chart.notes.map((n) => ({ id: n.id, pitch: n.pitch, t: noteTimeMs(chart, n) })).sort((a, b) => a.t - b.t);
  const strictOf = new Map(results.judgments.map((j) => [j.noteId, j]));
  const empty = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  const hits = results.judgments.filter((j) => j.judgment !== "MISS" && j.eventIndex !== null);
  if (hits.length < s.minHits) {
    return { enough: false, accuracy: 0, strict: results.accuracy, counts: empty, bpmRange: null, recovered: 0, judgments: [] };
  }

  // One-to-one, walking forward: each note takes its strict hit's press when that press sits near the curve fitted so
  // far, else the nearest unused press of its pitch near it. A strict hit far off the curve is the judge pairing a
  // drifted note with its same-pitch neighbour's press (decision: tempo-curve-strict-hits); it's released.
  const strictPress = new Map(hits.map((j) => [j.noteId, j.eventIndex!]));
  const pressOf = new Map<string, number>(); // note id -> event index
  const used = new Set<number>();
  const points: Point[] = [];
  for (const n of notes) {
    const expect = points.length ? fitCurve(points, windowMs).at(n.t) : n.t;
    const near = (i: number) => !used.has(i) && take.events[i].pitch === n.pitch && Math.abs(take.events[i].timeMs - expect) <= s.matchMs;
    let best = strictPress.has(n.id) && near(strictPress.get(n.id)!) ? strictPress.get(n.id)! : -1;
    if (best < 0) {
      take.events.forEach((e, i) => {
        if (near(i) && (best < 0 || Math.abs(e.timeMs - expect) < Math.abs(take.events[best].timeMs - expect))) best = i;
      });
    }
    if (best < 0) continue;
    pressOf.set(n.id, best);
    used.add(best);
    points.push({ t: n.t, p: take.events[best].timeMs });
  }

  const curve = fitCurve(points, windowMs);
  // WRONG notes as strict judged them, except presses the curve matched to a note: those were drift, not wrong keys.
  const wrong = (results.wrong ?? []).filter((w) => !used.has(w.eventIndex)).length;
  const counts = { ...empty };
  let recovered = 0;
  const judgments = notes.map((n) => {
    const offsetMs = pressOf.has(n.id) ? take.events[pressOf.get(n.id)!].timeMs - curve.at(n.t) : null;
    const judgment = offsetMs === null ? "MISS" : judge(offsetMs);
    counts[judgment]++;
    if (judgment !== "MISS" && strictOf.get(n.id)?.judgment === "MISS") recovered++;
    return { noteId: n.id, judgment, offsetMs };
  });
  const tempos = notes.map((n) => curve.tempo(n.t) * chart.bpm);
  return {
    enough: true,
    accuracy: passAccuracy({ ...counts, wrong }, notes.length),
    strict: results.accuracy,
    counts,
    bpmRange: [Math.round(Math.min(...tempos)), Math.round(Math.max(...tempos))],
    recovered,
    judgments,
  };
}

const pct = (a: number) => `${Math.round(a * 100)}%`;

// The panel's lines, as text.
export function describeRubato(r: Rubato): string[] {
  if (!r.enough) return [`Not enough hits to fit a tempo curve (it needs ${tempoCurveSettings.minHits})`];
  const [lo, hi] = r.bpmRange!;
  return [
    `Rubato score ${pct(r.accuracy)} · strict ${pct(r.strict)}`,
    `${lo === hi ? `${lo} BPM` : `${lo} to ${hi} BPM`} · ${r.recovered} ${r.recovered === 1 ? "note" : "notes"} recovered from MISS`,
  ];
}

// A results panel (play-slots): the rubato score next to the strict one. It never changes the strict results.
export function tempoCurve(): GamePlugin {
  return {
    id: "tempo-curve",
    resultsPanel({ chart, take, results }) {
      const [main, detail] = describeRubato(rubato(chart, take, results));
      return createElement(
        "div",
        { "data-testid": "tempo-curve", style: { textAlign: "center", lineHeight: 1.5 } },
        createElement("div", { style: { fontSize: "1.15em", color: "var(--pa-ink)" } }, main),
        detail && createElement("div", { style: { fontSize: "0.9em", color: "var(--pa-ink-dim)" } }, detail),
      );
    },
  };
}
