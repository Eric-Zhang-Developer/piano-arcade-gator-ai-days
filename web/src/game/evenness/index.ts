import { createElement } from "react";
import type { Chart, ChartNote, GamePlugin, Hand, Results, Take } from "../../contracts";
import { msPerBeat } from "../core/settings";

export const evennessSettings = {
  minRun: 4, // notes in a run; change this before changing the formula
  minGaps: 3, // a piece of a run (split by a MISS) with fewer played gaps is dropped
  toleranceBeats: 1 / 48, // chart gaps this close count as equal, and notes this close as one onset
};

export interface Run {
  hand: Hand;
  notes: ChartNote[]; // in order, equal chart gaps, each alone in its hand at its onset
  gapBeats: number;
}

export interface ScoredRun {
  hand: Hand;
  fromBeat: number;
  toBeat: number;
  gapMs: number;
  gaps: number; // played gaps
  sdMs: number;
  score: number; // 0–100
}

export interface Evenness {
  hasRuns: boolean; // the chart has runs at all
  hands: { hand: Hand; score: number }[]; // only hands with a scored run
  worst: ScoredRun | null; // the least even scored run
}

const near = (a: number, b: number) => Math.abs(a - b) <= evennessSettings.toleranceBeats;

// Each hand's runs. A chord in that hand, or a change of gap, ends a run; the note where the gap changes starts the
// next one, so Twinkle's C C G G A A G is one run and the half note's longer gap ends it.
export function findRuns(chart: Chart): Run[] {
  const runs: Run[] = [];
  for (const hand of ["R", "L"] as const) {
    const notes = chart.notes.filter((n) => n.hand === hand).sort((a, b) => a.beat - b.beat);
    const onsets: ChartNote[][] = [];
    for (const n of notes) {
      const last = onsets.at(-1);
      if (last && near(last[0].beat, n.beat)) last.push(n);
      else onsets.push([n]);
    }
    let run: ChartNote[] = [];
    const close = () => {
      if (run.length >= evennessSettings.minRun) runs.push({ hand, notes: run, gapBeats: run[1].beat - run[0].beat });
      run = [];
    };
    for (const onset of onsets) {
      if (onset.length > 1) {
        close();
        continue;
      }
      const n = onset[0];
      if (run.length >= 2 && !near(n.beat - run.at(-1)!.beat, run[1].beat - run[0].beat)) {
        const last = run.at(-1)!;
        close();
        run = [last];
      }
      run.push(n);
    }
    close();
  }
  return runs;
}

// Score this take's runs from its press times. A MISS splits a run into pieces, each scored on its own.
export function scoreEvenness(chart: Chart, take: Take, results: Results): Evenness {
  const runs = findRuns(chart);
  const pressOf = new Map(results.judgments.map((j) => [j.noteId, j.eventIndex === null ? null : take.events[j.eventIndex]?.timeMs ?? null]));
  const scored: ScoredRun[] = [];
  for (const run of runs) {
    const gapMs = run.gapBeats * msPerBeat(chart.bpm);
    let piece: { beat: number; t: number }[] = [];
    const close = () => {
      const gaps = piece.slice(1).map((p, i) => p.t - piece[i].t);
      if (gaps.length >= evennessSettings.minGaps) {
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const sdMs = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
        const score = Math.round(Math.min(100, Math.max(0, 100 * (1 - sdMs / gapMs))));
        scored.push({ hand: run.hand, fromBeat: piece[0].beat, toBeat: piece.at(-1)!.beat, gapMs, gaps: gaps.length, sdMs, score });
      }
      piece = [];
    };
    for (const n of run.notes) {
      const t = pressOf.get(n.id);
      if (t === null || t === undefined) close();
      else piece.push({ beat: n.beat, t });
    }
    close();
  }
  const hands = (["R", "L"] as const).flatMap((hand) => {
    const mine = scored.filter((s) => s.hand === hand);
    const gaps = mine.reduce((a, s) => a + s.gaps, 0);
    return gaps ? [{ hand, score: Math.round(mine.reduce((a, s) => a + s.score * s.gaps, 0) / gaps) }] : [];
  });
  const worst = scored.reduce<ScoredRun | null>((w, s) => (!w || s.score < w.score ? s : w), null);
  return { hasRuns: runs.length > 0, hands, worst };
}

const handName = { R: "Right hand", L: "Left hand" };

// The panel's lines, as text.
export function describeEvenness(e: Evenness, chart: Chart): { hands: string[]; worst: string | null; empty: string | null } {
  if (!e.hasRuns) return { hands: [], worst: null, empty: "No runs to score in this song" };
  if (!e.hands.length) return { hands: [], worst: null, empty: "Not enough of a run played to score evenness" };
  const w = e.worst;
  const bar = (beat: number) => Math.floor(beat / chart.beatsPerBar) + 1;
  const bars = w && (bar(w.fromBeat) === bar(w.toBeat) ? `Bar ${bar(w.fromBeat)}` : `Bars ${bar(w.fromBeat)}–${bar(w.toBeat)}`);
  const step = w && (Math.abs(w.gapMs - msPerBeat(chart.bpm)) < 1 ? "beat" : "step");
  return {
    hands: e.hands.map((h) => `${handName[h.hand]} evenness ${h.score}`),
    worst:
      w && w.score < 100
        ? `${bars}, ${handName[w.hand].toLowerCase()}: gaps varied ±${Math.round(w.sdMs)} ms on a ${Math.round(w.gapMs)} ms ${step}`
        : null,
    empty: null,
  };
}

// A results panel (play-slots): how even each hand's runs were, from this take only. Timing only, so laptop keys count.
export function evenness(): GamePlugin {
  return {
    id: "evenness",
    resultsPanel({ chart, take, results }) {
      const d = describeEvenness(scoreEvenness(chart, take, results), chart);
      if (d.empty) return null; // no runs, or too little played: no card (duo-details)
      const line = (text: string, style: Record<string, string> = {}) => createElement("div", { key: text, style }, text);
      return createElement(
        "div",
        { "data-testid": "evenness", style: { lineHeight: 1.5 } },
        ...d.hands.map((h) => line(h, { fontSize: "1.15em", color: "var(--pa-ink)" })),
        d.worst && line(d.worst, { color: "var(--pa-ink-dim)", fontSize: "0.9em" }),
      );
    },
  };
}
