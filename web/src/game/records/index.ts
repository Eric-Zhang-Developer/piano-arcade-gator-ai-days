// Records: best grades and a local top 5 with arcade initials (spec: records). The take is recorded when it ends
// (songEnd), so leaving the results screen without entering initials keeps it as "---".
import { createElement } from "react";
import type { GamePlugin } from "../../contracts";
import { emptyHud, reduceHud } from "../hud";
import { RecordsPanel, type Outcome } from "./panel";
import { addTake, browserStorage, loadRecords, practiceReason, recordKey, saveRecords } from "./store";

export function records(): GamePlugin {
  let chartId = "";
  let params = new URLSearchParams();
  let hud = emptyHud(); // the score the player saw, rebuilt with the HUD's own reducer
  let outcome: Outcome | null = null;
  return {
    id: "records",
    transformChart(chart, p) {
      chartId = recordKey(chart.id, p);
      params = p;
      return chart;
    },
    onEvent(e) {
      hud = reduceHud(hud, e);
      if (e.type === "songStart") outcome = null;
      if (e.type !== "songEnd") return;
      if (practiceReason(params)) {
        outcome = { kind: "practice" };
        return;
      }
      const storage = browserStorage();
      const stored = loadRecords(storage);
      const date = new Date().toISOString();
      const { results } = e;
      const added = stored && addTake(stored, chartId, { score: hud.score, accuracy: results.accuracy, rank: results.rank, maxCombo: results.maxCombo, date });
      outcome =
        added && saveRecords(storage, added.records)
          ? { kind: "recorded", chartId, date, newRecord: added.newRecord, inTop: added.inTop, top: added.records[chartId].top }
          : { kind: "blocked" };
    },
    resultsPanel: () => (outcome ? createElement(RecordsPanel, { outcome }) : null),
  };
}
