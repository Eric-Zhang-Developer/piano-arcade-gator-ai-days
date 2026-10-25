import { createElement } from "react";
import { kitButton } from "../duo-tokens";
import type { Chart, GamePlugin, Results, Take } from "../../contracts";
import { passAccuracy } from "../bar-loop";
import { msPerBeat } from "../core/settings";
import { inMode, playMode } from "../play-modes/modes";

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

// bar-loop on the phrase at practiceTempo, keeping only the params that pick the song, in the take's mode (play-modes:
// under Flow, no tempo).
export function practiceUrl(chart: Chart, params: URLSearchParams, p: Phrase): string {
  const q = new URLSearchParams({ song: params.get("song") ?? chart.id });
  if (params.has("hands")) q.set("hands", params.get("hands")!);
  q.set("from", String(p.from));
  q.set("to", String(p.to));
  q.set("tempo", String(weakBarsSettings.practiceTempo));
  return `/play?${inMode(q, playMode(params))}`;
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
              padding: "6px 10px",
              borderRadius: 0,
              minWidth: 72,
              background: s === worst ? "color-mix(in srgb, var(--pa-primary) 14%, transparent)" : "var(--pa-panel)",
              border: `1px solid ${s === worst ? "var(--pa-primary)" : "var(--pa-line)"}`,
              fontFamily: "var(--pa-font-data), ui-monospace, monospace",
              fontVariantNumeric: "tabular-nums",
              fontSize: "0.8em",
              lineHeight: 1.3,
            },
          },
          createElement("div", { style: { color: "var(--pa-ink-dim)", whiteSpace: "nowrap" } }, label(s)),
          createElement("div", { style: { color: "var(--pa-ink)", fontSize: "1.25em" } }, `${Math.round(s.accuracy * 100)}%`),
        );
      return createElement(
        "div",
        { "data-testid": "weak-bars" },
        createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 6 } }, ...scores.map(cell)),
        worst
          ? createElement(
              "a",
              {
                href: practiceUrl(chart, params, worst),
                "data-testid": "weak-bars-practice",
                className: kitButton("primary").className,
                style: { ...kitButton("primary").style, marginTop: 14 },
              },
              `Practice ${label(worst).toLowerCase()} ${playMode(params) === "flow" ? "in Flow" : `at ${weakBarsSettings.practiceTempo}%`}`,
            )
          : createElement("div", { style: { marginTop: 8, color: "var(--pa-ink-dim)" } }, "No weak bars"),
      );
    },
  };
}
