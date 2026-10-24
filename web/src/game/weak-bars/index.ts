import { createElement } from "react";
import type { Chart, GamePlugin, Results, Take } from "../../contracts";
import { passAccuracy } from "../bar-loop";
import { msPerBeat } from "../core/settings";

export const weakBarsSettings = {
  phraseBars: 2, // bars per phrase, from bar 1
  practiceTempo: 80, // percent, for the Practice link
};

export interface Phrase {
  from: number; // bar, 1-based, as bar-loop numbers bars
  to: number;
  noteIds: string[];
}

export interface PhraseScore extends Phrase {
  accuracy: number; // 0–1
}

// Groups of phraseBars bars from bar 1; the last may be shorter, and a phrase with no notes is skipped.
export function phrases(chart: Chart): Phrase[] {
  const { phraseBars } = weakBarsSettings;
  const bars = Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar);
  const out: Phrase[] = [];
  for (let from = 1; from <= bars; from += phraseBars) {
    const to = Math.min(bars, from + phraseBars - 1);
    const [lo, hi] = [(from - 1) * chart.beatsPerBar, to * chart.beatsPerBar];
    const noteIds = chart.notes.filter((n) => n.beat >= lo && n.beat < hi).map((n) => n.id);
    if (noteIds.length) out.push({ from, to, noteIds });
  }
  return out;
}

// Each phrase's accuracy by the judge's formula: its notes, plus the WRONG presses that fall in it.
export function scorePhrases(chart: Chart, take: Take, results: Results): PhraseScore[] {
  const judgment = new Map(results.judgments.map((j) => [j.noteId, j.judgment]));
  const barMs = chart.beatsPerBar * msPerBeat(chart.bpm);
  const wrongTimes = (results.wrong ?? []).map((w) => take.events[w.eventIndex]?.timeMs).filter((t) => t !== undefined);
  return phrases(chart).map((p) => {
    const count = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 };
    for (const id of p.noteIds) count[judgment.get(id) ?? "MISS"]++;
    count.wrong = wrongTimes.filter((t) => t >= (p.from - 1) * barMs && t < p.to * barMs).length;
    return { ...p, accuracy: passAccuracy(count, p.noteIds.length) };
  });
}

// The lowest accuracy, earliest on a tie; null when every phrase is at 100%.
export const weakest = (scores: PhraseScore[]) =>
  scores.reduce<PhraseScore | null>((w, s) => (s.accuracy < 1 && (!w || s.accuracy < w.accuracy) ? s : w), null);

// bar-loop on the phrase at practiceTempo, keeping only the params that pick the song.
export function practiceUrl(chart: Chart, params: URLSearchParams, p: Phrase): string {
  const q = new URLSearchParams({ song: params.get("song") ?? chart.id });
  if (params.has("hands")) q.set("hands", params.get("hands")!);
  q.set("from", String(p.from));
  q.set("to", String(p.to));
  q.set("tempo", String(weakBarsSettings.practiceTempo));
  return `/play?${q}`;
}

const label = (p: Phrase) => (p.from === p.to ? `Bar ${p.from}` : `Bars ${p.from}–${p.to}`);

// A results panel (play-slots): accuracy per phrase, and one click to loop the weakest at a slower tempo.
export function weakBars(): GamePlugin {
  return {
    id: "weak-bars",
    resultsPanel({ chart, take, results, params }) {
      if (params.has("from") || params.has("to")) return null; // bar-loop's own passes panel covers a loop take
      const scores = scorePhrases(chart, take, results);
      const worst = weakest(scores);
      const cell = (s: PhraseScore) =>
        createElement(
          "div",
          {
            key: s.from,
            "data-testid": "weak-bars-cell",
            "data-weakest": s === worst || undefined,
            style: {
              padding: "4px 8px",
              borderRadius: 6,
              minWidth: 64,
              background: s === worst ? "rgba(255, 77, 94, 0.18)" : "var(--pa-panel)",
              border: `1px solid ${s === worst ? "var(--pa-wrong)" : "rgba(242, 242, 245, 0.15)"}`,
              fontSize: "0.8em",
              lineHeight: 1.3,
            },
          },
          createElement("div", { style: { color: "var(--pa-ink-dim)" } }, label(s)),
          createElement("div", { style: { color: "var(--pa-ink)", fontSize: "1.25em" } }, `${Math.round(s.accuracy * 100)}%`),
        );
      return createElement(
        "div",
        { "data-testid": "weak-bars", style: { textAlign: "center" } },
        createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" } }, ...scores.map(cell)),
        worst
          ? createElement(
              "a",
              {
                href: practiceUrl(chart, params, worst),
                "data-testid": "weak-bars-practice",
                style: {
                  display: "inline-block",
                  marginTop: 10,
                  padding: "6px 14px",
                  borderRadius: 8,
                  background: "var(--pa-hand-r)",
                  color: "#000",
                  textDecoration: "none",
                  fontWeight: 600,
                },
              },
              `Practice ${label(worst).toLowerCase()} at ${weakBarsSettings.practiceTempo}%`,
            )
          : createElement("div", { style: { marginTop: 8, color: "var(--pa-ink-dim)" } }, "No weak bars"),
      );
    },
  };
}
