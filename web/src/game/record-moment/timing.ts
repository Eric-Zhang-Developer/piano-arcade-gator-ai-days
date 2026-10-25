// Record moment's timing (spec: record-moment), in ms after the results show. Pure, so it tests without a page.
import type { Outcome } from "../records";
import { stampAfterMs, stampSettings } from "../rank-stamp";

export const momentSettings = {
  stampMs: stampSettings.durationMs, // NEW RECORD stamps on rank-stamp's curve, for as long
  cellsMs: 200, // then the cells rise in (150–250 per the spec)
};

export function momentTimes() {
  const startMs = stampAfterMs(); // when the rank stamp ends (results-landing: 250 ms after its stamp)
  const cellsAtMs = startMs + momentSettings.stampMs;
  return { startMs, cellsAtMs, endMs: cellsAtMs + momentSettings.cellsMs };
}

// Only a recorded take that beat the best: never a practice take, blocked storage, or a top-5 place alone.
export const showsMoment = (o: Outcome | null): o is Extract<Outcome, { kind: "recorded" }> => o?.kind === "recorded" && o.newRecord;
