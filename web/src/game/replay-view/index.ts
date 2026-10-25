// Replay view: watch your take on the highway while the piano plays it back (spec: replay-view). The pure clock and
// highway state are here; the overlay is overlay.tsx.
import { createElement } from "react";
import type { Chart, GamePlugin, Judgment, Results, Take } from "../../contracts";
import type { HighwayState } from "../core/highway";
import { noteTimeMs } from "../core/judge";
import { GOOD_MS, msPerBeat } from "../core/settings";
import { pianoOutSettings } from "../piano-out";
import { ReplayButton } from "./overlay";

// The replay's span on the chart clock: one bar before the first press to one bar after the last release.
export function replaySpan(chart: Chart, take: Take) {
  const bar = chart.beatsPerBar * msPerBeat(chart.bpm);
  const presses = take.events.filter((e) => e.velocity > 0);
  const firstPressMs = Math.min(...presses.map((e) => e.timeMs));
  const lastOffMs = Math.max(...presses.map((e) => e.offTimeMs ?? e.timeMs + pianoOutSettings.heldMs));
  return { firstPressMs, fromMs: firstPressMs - bar, toMs: lastOffMs + bar, barMs: bar };
}

// The chart time at wall time perf, given the wall time the replay started (startReplay's call). piano-out plays the
// first press leadMs after its start, so a press marker crosses the line as the piano sounds it.
export const replayChartTime = (perf: number, startPerf: number, firstPressMs: number, leadMs = pianoOutSettings.leadMs) =>
  firstPressMs + (perf - startPerf - leadMs);

const heldUntil = (e: Take["events"][number]) => e.offTimeMs ?? e.timeMs + pianoOutSettings.heldMs;

// What the highway shows at chart time t: each note in its judged state once it was judged (a hit at its press, a
// miss once its window closed), the keys held by presses at t, and the latest judgment text.
export function highwayAt(chart: Chart, take: Take, results: Results, t: number): HighwayState {
  const byId = new Map(chart.notes.map((n) => [n.id, n]));
  const noteState = new Map<string, Judgment>();
  let latest: HighwayState["latest"] = null;
  for (const j of results.judgments) {
    const note = byId.get(j.noteId);
    if (!note) continue;
    const at = j.judgment === "MISS" || j.eventIndex === null ? noteTimeMs(chart, note) + GOOD_MS : take.events[j.eventIndex].timeMs;
    if (at > t) continue;
    noteState.set(j.noteId, j.judgment);
    if (!latest || at >= latest.atMs) latest = { judgment: j.judgment, offsetMs: j.offsetMs, atMs: at };
  }
  const pressed = new Set(take.events.filter((e) => e.velocity > 0 && e.timeMs <= t && t < heldUntil(e)).map((e) => e.pitch));
  return { nowMs: t, noteState, pressed, latest, countInBeat: null };
}

// The presses the game called LATE: a hit past PERFECT, after its note (the highway's "LATE +n" label). The replay
// rings them in red, so the slip a take is watched for stands out (#1093). Indices into take.events.
export const latePresses = (results: Results) =>
  new Set(results.judgments.flatMap((j) => (j.eventIndex !== null && j.judgment !== "PERFECT" && j.judgment !== "MISS" && (j.offsetMs ?? 0) > 0 ? [j.eventIndex] : [])));

export function replayView(): GamePlugin {
  return {
    id: "replay-view",
    resultsPanel: ({ chart, take, results }) =>
      take.events.some((e) => e.velocity > 0) ? createElement(ReplayButton, { chart, take, results }) : null,
  };
}
