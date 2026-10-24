import { describe, expect, it } from "vitest";
import type { Chart, Take } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { pianoOutSettings } from "../piano-out";
import { highwayAt, replayChartTime, replaySpan, replayView } from ".";

// 4/4 at 120 bpm (500 ms a beat, 2 s a bar): C D E F on beats 0–3.
const chart: Chart = {
  id: "t", title: "t", composer: "t", source: "test", bpm: 120, beatsPerBar: 4,
  notes: [60, 62, 64, 65].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" as const })),
};
// C on time, D 30 ms late and held 400 ms, E skipped (MISS), F on time.
const take: Take = {
  chartId: "t", startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: 0, inputDevice: "test",
  events: [
    { pitch: 60, velocity: 80, timeMs: 0, offTimeMs: 300 },
    { pitch: 62, velocity: 80, timeMs: 530, offTimeMs: 930 },
    { pitch: 65, velocity: 80, timeMs: 1500, offTimeMs: null },
  ],
};
const results = judgeTake(chart, take);

describe("the replay clock", () => {
  it("spans one bar before the first press to one bar after the last release", () => {
    expect(replaySpan(chart, take)).toEqual({ firstPressMs: 0, fromMs: -2000, toMs: 1500 + pianoOutSettings.heldMs + 2000, barMs: 2000 });
  });

  it("puts the first press on the line leadMs after piano-out starts, at 1×", () => {
    const lead = pianoOutSettings.leadMs;
    expect(replayChartTime(10_000 + lead, 10_000, 0)).toBe(0);
    expect(replayChartTime(10_000 + lead + 530, 10_000, 0)).toBe(530);
    expect(replayChartTime(10_000, 10_000, 250, 200)).toBe(50);
  });
});

describe("the highway at a chart time", () => {
  it("shows hits from their press and a miss once its window closes", () => {
    expect([...highwayAt(chart, take, results, -1).noteState]).toEqual([]);
    expect([...highwayAt(chart, take, results, 0).noteState]).toEqual([["n0", "PERFECT"]]);
    expect(highwayAt(chart, take, results, 529).noteState.has("n1")).toBe(false);
    expect(highwayAt(chart, take, results, 530).noteState.get("n1")).toBe("GREAT");
    const missAt = noteTimeMs(chart, chart.notes[2]) + 100;
    expect(highwayAt(chart, take, results, missAt - 1).noteState.has("n2")).toBe(false);
    expect(highwayAt(chart, take, results, missAt).noteState.get("n2")).toBe("MISS");
  });

  it("lights the keys held by presses at that time", () => {
    expect([...highwayAt(chart, take, results, 100).pressed]).toEqual([60]);
    expect([...highwayAt(chart, take, results, 600).pressed]).toEqual([62]);
    expect([...highwayAt(chart, take, results, 1600).pressed]).toEqual([65]); // no release: held heldMs
    expect([...highwayAt(chart, take, results, 1500 + pianoOutSettings.heldMs).pressed]).toEqual([]);
  });

  it("shows the latest judgment, with its offset", () => {
    expect(highwayAt(chart, take, results, 600).latest).toMatchObject({ judgment: "GREAT", atMs: 530 });
  });
});

describe("the panel", () => {
  it("offers Watch replay only for a take with a press", () => {
    const p = replayView();
    expect(p.resultsPanel!({ chart, take, results, params: new URLSearchParams(), retry() {} })).not.toBeNull();
    const empty = { ...take, events: [] };
    expect(p.resultsPanel!({ chart, take: empty, results: judgeTake(chart, empty), params: new URLSearchParams(), retry() {} })).toBeNull();
  });
});
