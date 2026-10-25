import { describe, expect, it } from "vitest";
import type { Chart, Take } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { dynamics, gradeDynamics, NO_DYNAMICS, NO_VELOCITY, summary, type DynamicsReport } from ".";

// 8 bars of 4/4, one note a beat: phrases are bars 1–2, 3–4, 5–6, 7–8. Bars 3–4 are forte (96), the rest piano (48).
const forte = (beat: number) => beat >= 8 && beat < 16;
const chart: Chart = {
  id: "t", title: "t", composer: "t", source: "test", bpm: 120, beatsPerBar: 4,
  notes: Array.from({ length: 32 }, (_, i) => ({ id: `n${i}`, pitch: 60 + (i % 5), beat: i, duration: 1, hand: "R" as const, velocity: forte(i) ? 96 : 48 })),
};

function play(c: Chart, velocity: (beat: number, chartVelocity: number) => number | null, inputDevice: Take["inputDevice"] = "test") {
  const events = c.notes.flatMap((n) => {
    const v = velocity(n.beat, n.velocity ?? 64);
    return v === null ? [] : [{ pitch: n.pitch, velocity: v, timeMs: noteTimeMs(c, n), offTimeMs: null }];
  });
  const take: Take = { chartId: c.id, startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: 0, inputDevice, events };
  return gradeDynamics(c, take, judgeTake(c, take));
}
const graded = (r: DynamicsReport) => {
  if (r.kind !== "graded") throw new Error(`not graded: ${r.text}`);
  return r;
};
const verdicts = (r: DynamicsReport) => graded(r).phrases.map((p) => p.verdict);

describe("gradeDynamics", () => {
  it("played at the chart's own velocities: every phrase ok", () => {
    const r = play(chart, (_, v) => v);
    expect(verdicts(r)).toEqual(["ok", "ok", "ok", "ok"]);
    expect(summary(graded(r).phrases)).toBe("All 4 graded phrases match the score");
  });

  it("the forte phrase played at the chart's piano level is too soft", () => {
    const r = play(chart, () => 48);
    expect(verdicts(r)).toEqual(["ok", "too soft", "ok", "ok"]);
    expect(Math.round(graded(r).phrases[1].diff!)).toBe(-36);
    expect(summary(graded(r).phrases)).toBe("1 of 4 phrases too soft");
  });

  it("every note 20 louder: every phrase ok, and the level line shows the difference", () => {
    const r = graded(play(chart, (_, v) => v + 20));
    expect(r.phrases.every((p) => p.verdict === "ok")).toBe(true);
    expect([r.playedMean, r.chartMean]).toEqual([80, 60]);
  });

  it("a phrase much louder than marked is too loud", () => {
    expect(verdicts(play(chart, (beat, v) => (beat >= 24 ? v + 40 : v)))).toEqual(["ok", "ok", "ok", "too loud"]);
  });

  it("a phrase with only 2 hit notes gets no verdict", () => {
    const r = graded(play(chart, (beat, v) => (beat >= 16 && beat < 22 ? null : v))); // bars 5–6: 2 of 8 played
    expect(r.phrases[2]).toMatchObject({ hits: 2, diff: null, verdict: null });
  });

  it("laptop keys and a score without dynamics each get their one-line message", () => {
    expect(play(chart, (_, v) => v, "keys")).toEqual({ kind: "message", text: NO_VELOCITY });
    const flat = { ...chart, notes: chart.notes.map((n) => ({ ...n, velocity: 62 })) };
    expect(play(flat, (_, v) => v)).toEqual({ kind: "message", text: NO_DYNAMICS });
    const none = { ...chart, notes: chart.notes.map((n) => ({ ...n, velocity: undefined })) };
    expect(play(none, () => 80)).toEqual({ kind: "message", text: NO_DYNAMICS });
  });

  it("a message is no card on the results screen; a graded take is (duo-details)", () => {
    const panel = (c: Chart, inputDevice: Take["inputDevice"]) => {
      const events = c.notes.map((n) => ({ pitch: n.pitch, velocity: n.velocity ?? 64, timeMs: noteTimeMs(c, n), offTimeMs: null }));
      const take: Take = { chartId: c.id, startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: 0, inputDevice, events };
      return dynamics().resultsPanel!({ chart: c, take, results: judgeTake(c, take), params: new URLSearchParams(), retry() {} });
    };
    expect(panel(chart, "keys")).toBeNull(); // NO_VELOCITY
    expect(panel({ ...chart, notes: chart.notes.map((n) => ({ ...n, velocity: 62 })) }, "test")).toBeNull(); // NO_DYNAMICS
    expect(panel(chart, "test")).not.toBeNull();
  });
});
