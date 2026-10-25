// #869: a saved Flow take must re-judge the way Flow judged it. The save plugin records each press at its time on an
// unpaused wall clock from chart zero, latency taken off: the time Flow judged steadiness in (the page's pause clock).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Results, Take } from "../../contracts";
import { judgeTake } from "../core/judge";
import { msPerBeat } from "../core/settings";
import { onsetsOf } from "./clock";
import { FlowJudge } from "./judge";
import { judgeFlowTake } from "./replay";

const twinkle: Chart = JSON.parse(readFileSync("public/songs/twinkle/chart.json", "utf8"));

// /play in miniature, as app/play/page.tsx runs a Flow take: frames every 16 ms (from `phase`) update the clock and
// advance the judge; a press gets its chart time from the clock and Flow its wall time, latency taken off both. The
// take is what the save plugin records: wall time minus latency.
function live(chart: Chart, presses: { pitch: number; wallMs: number }[], latency: number, phase = 0): { take: Take; results: Results } {
  const judge = new FlowJudge(chart);
  const mpb = msPerBeat(chart.bpm);
  const events: Take["events"] = [];
  const sorted = [...presses].sort((a, b) => a.wallMs - b.wallMs);
  const start = onsetsOf(chart)[0].ms - 4 * mpb + phase;
  const end = sorted.at(-1)!.wallMs + 2 * mpb;
  let k = 0;
  for (let t = start; t <= end; t += 16) {
    for (; k < sorted.length && sorted[k].wallMs <= t; k++) {
      const { pitch, wallMs } = sorted[k];
      const chartMs = judge.clock.holding ? judge.clock.now(wallMs) : judge.clock.now(wallMs) - latency;
      events.push({ pitch, velocity: 80, timeMs: wallMs - latency, offTimeMs: null });
      judge.press(pitch, chartMs, events.length - 1, wallMs - latency);
    }
    judge.clock.update(t);
    judge.advance(judge.clock.now(t));
  }
  const take: Take = { chartId: chart.id, startedAt: "2026-10-25T10:00:00.000Z", latencyOffsetMs: latency, inputDevice: "keys", events };
  return { take, results: judge.finish(judge.clock.now(end)) };
}

// A player at a fraction r of the chart's tempo, a little uneven (every third onset 40 ms late), with one onset
// skipped, so the take has GREATs, GOODs, a MISS and a slip to reproduce.
function player(chart: Chart, r: number, skip = 7) {
  const onsets = onsetsOf(chart);
  const b0 = onsets[0].ms;
  return onsets.flatMap((o, k) =>
    k === skip ? [] : o.ids.map((id) => ({ pitch: chart.notes.find((n) => n.id === id)!.pitch, wallMs: b0 + (o.ms - b0) / r + (k % 3 === 2 ? 40 : 0) })),
  );
}

const summary = (r: Results) => ({ counts: r.counts, accuracy: r.accuracy, maxCombo: r.maxCombo, rank: r.rank, judgments: r.judgments.map((j) => j.judgment) });

describe("a saved Flow take (#869)", () => {
  it("re-judged by the timed judge, it isn't the take Flow judged", () => {
    const { take, results } = live(twinkle, player(twinkle, 0.75), 25);
    expect(results.counts.MISS).toBe(1);
    expect(judgeTake(twinkle, take).counts.MISS).toBeGreaterThan(results.counts.MISS);
  });

  it.each([
    ["at 75%, 25 ms latency", 0.75, 25, 0],
    ["at 100%, no latency, frames out of phase", 1, 0, 7],
    ["at 120%, 40 ms latency", 1.2, 40, 11],
  ])("re-judged by judgeFlowTake, it matches the results: %s", (_, r, latency, phase) => {
    const { take, results } = live(twinkle, player(twinkle, r), latency, phase);
    expect(summary(judgeFlowTake(twinkle, take))).toEqual(summary(results));
  });
});
