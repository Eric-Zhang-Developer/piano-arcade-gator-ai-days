// The list the /progress switch offers: one line per synthetic learner. Written by `run.mjs --roster` from the same
// generator the loader stores, so the server can answer with it at once instead of simulating 200 learners per request.
import type { SyntheticLearner } from "../../learn/frontend/mastery/sim";
import type { ChartSource, SyntheticRows } from "./generate";
import roster from "./roster.json";

export type RosterEntry = {
  id: string;
  /** The starting level the simulation drew, as SIM names it. */
  level: string;
  input: "midi" | "keys";
  /** Goal song titles, at most three. */
  goals: string[];
  takes: number;
  songs: number;
  /** Mean accuracy over every take, 0 to 1. */
  accuracy: number;
};

export const ROSTER = roster as RosterEntry[];

export function rosterEntry(learner: SyntheticLearner, rows: SyntheticRows, sources: readonly ChartSource[]): RosterEntry {
  const title = new Map(sources.map((s) => [s.chart.id, s.chart.title]));
  const accuracy = rows.takes.reduce((sum, t) => sum + t.take.accuracy, 0) / Math.max(1, rows.takes.length);
  return {
    id: learner.id,
    level: learner.startingLevel,
    input: learner.input === "midi" ? "midi" : "keys",
    goals: learner.goals.songIds.slice(0, 3).map((id) => title.get(id) ?? id),
    takes: rows.takes.length,
    songs: rows.songs.length,
    accuracy: Math.round(accuracy * 1000) / 1000,
  };
}
