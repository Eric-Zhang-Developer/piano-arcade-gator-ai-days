import { describe, expect, it } from "vitest";
import { validateChart, type Chart } from ".";

const chart: Chart = {
  id: "t",
  title: "T",
  composer: "C",
  source: "Eric",
  bpm: 100,
  beatsPerBar: 4,
  notes: [{ id: "n1", pitch: 60, beat: 0, duration: 1, hand: "R" }],
};
const note = chart.notes[0];

describe("validateChart: the optional voice and velocity", () => {
  it("accepts a chart without them, and with them in range", () => {
    expect(validateChart(chart)).toEqual([]);
    expect(validateChart({ ...chart, voice: 4, notes: [{ ...note, velocity: 127 }] })).toEqual([]);
  });

  it("names a voice outside 1–128 and a velocity outside 1–127", () => {
    expect(validateChart({ ...chart, voice: 0 })).toEqual(["voice must be 1–128"]);
    expect(validateChart({ ...chart, voice: 4.5 })).toEqual(["voice must be 1–128"]);
    expect(validateChart({ ...chart, notes: [{ ...note, velocity: 0 }] })).toEqual(["note 0: velocity must be 1–127"]);
    expect(validateChart({ ...chart, notes: [{ ...note, velocity: 128 }] })).toEqual(["note 0: velocity must be 1–127"]);
  });
});
