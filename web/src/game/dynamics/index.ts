// Dynamics: how loud you played against the score, phrase by phrase (spec: dynamics). Pure grading here; the
// results panel is panel.tsx.
import { createElement } from "react";
import type { Chart, GamePlugin, Results, Take } from "../../contracts";
import { DynamicsPanel } from "./panel";

export const dynamicsSettings = {
  phraseBars: 2, // the same split weak-bars uses
  toleranceVel: 12, // played shape minus score shape beyond this is too loud / too soft
  minHits: 3, // a phrase with fewer hit notes gets no verdict
};

export const NO_DYNAMICS = "This score marks no dynamics";
export const NO_VELOCITY = "Laptop keys don't sense how hard you play";

export type Verdict = "too loud" | "too soft" | "ok";

export interface Phrase {
  fromBar: number; // 1-based, inclusive (bar-loop's numbering)
  toBar: number;
  hits: number;
  diff: number | null; // played shape minus the score's, in velocity; null with fewer than minHits hits
  verdict: Verdict | null;
}

export type DynamicsReport =
  | { kind: "message"; text: string }
  | { kind: "graded"; phrases: Phrase[]; playedMean: number; chartMean: number };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// The rule grades shape, not level: the DGX's touch response isn't the export's. A phrase's score shape is its mean
// chart velocity minus the chart's; its played shape is its mean played velocity minus the mean over all hit notes.
export function gradeDynamics(chart: Chart, take: Take, results: Results): DynamicsReport {
  const velocities = chart.notes.map((n) => n.velocity);
  if (velocities.some((v) => v === undefined) || new Set(velocities).size < 2) return { kind: "message", text: NO_DYNAMICS };
  if (take.inputDevice !== "midi" && take.inputDevice !== "test") return { kind: "message", text: NO_VELOCITY };

  const { phraseBars, toleranceVel, minHits } = dynamicsSettings;
  const phraseOf = (beat: number) => Math.floor(Math.floor(beat / chart.beatsPerBar) / phraseBars);
  const byId = new Map(chart.notes.map((n) => [n.id, n]));
  const hits = results.judgments.flatMap((j) => {
    const note = byId.get(j.noteId);
    const event = j.eventIndex === null ? undefined : take.events[j.eventIndex];
    return j.judgment !== "MISS" && note && event ? [{ phrase: phraseOf(note.beat), chart: note.velocity!, played: event.velocity }] : [];
  });
  const chartMean = mean(velocities as number[]);
  const playedMean = hits.length ? mean(hits.map((h) => h.played)) : 0;

  const count = Math.max(...chart.notes.map((n) => phraseOf(n.beat))) + 1;
  const phrases: Phrase[] = Array.from({ length: count }, (_, i) => {
    const inPhrase = hits.filter((h) => h.phrase === i);
    const fromBar = i * phraseBars + 1;
    const base = { fromBar, toBar: fromBar + phraseBars - 1, hits: inPhrase.length };
    if (inPhrase.length < minHits) return { ...base, diff: null, verdict: null };
    const score = mean(chart.notes.filter((n) => phraseOf(n.beat) === i).map((n) => n.velocity!)) - chartMean;
    const diff = mean(inPhrase.map((h) => h.played)) - playedMean - score;
    return { ...base, diff, verdict: diff > toleranceVel ? "too loud" : diff < -toleranceVel ? "too soft" : "ok" };
  });
  return { kind: "graded", phrases, playedMean, chartMean };
}

// "2 of 6 phrases too soft", "1 of 6 phrases too loud, 2 too soft", or "All 6 graded phrases match the score".
export function summary(phrases: Phrase[]): string {
  const graded = phrases.filter((p) => p.verdict).length;
  const loud = phrases.filter((p) => p.verdict === "too loud").length;
  const soft = phrases.filter((p) => p.verdict === "too soft").length;
  if (!graded) return "Too few notes hit to grade any phrase";
  if (loud && soft) return `${loud} of ${graded} phrases too loud, ${soft} too soft`;
  if (loud) return `${loud} of ${graded} phrases too loud`;
  if (soft) return `${soft} of ${graded} phrases too soft`;
  return `All ${graded} graded phrases match the score`;
}

export function dynamics(): GamePlugin {
  return {
    id: "dynamics",
    resultsPanel: ({ chart, take, results }) => createElement(DynamicsPanel, { report: gradeDynamics(chart, take, results) }),
  };
}
