// A results panel (play-slots): chords this take rolled by more than 30 ms, per hand (spec: chord-sync).
import { createElement } from "react";
import type { GamePlugin } from "../../contracts";
import { describeChords, scoreChords } from "./chords";

export { chordSyncSettings, describeChords, direction, findChords, isRolled, scoreChords } from "./chords";

export function chordSync(): GamePlugin {
  return {
    id: "chord-sync",
    resultsPanel({ chart, take, results }) {
      const d = describeChords(chart, scoreChords(chart, take, results));
      if (!d) return null; // no chords in this chart
      const line = (text: string, style: Record<string, string> = {}) => createElement("div", { key: text, style }, text);
      return createElement(
        "div",
        { "data-testid": "chord-sync", style: { textAlign: "center", lineHeight: 1.5 } },
        line(d.summary, { fontSize: "1.15em", color: "var(--pa-ink)" }),
        ...d.rows.map((r) => line(r, { color: "var(--pa-ink-dim)", fontSize: "0.9em" })),
      );
    },
  };
}
