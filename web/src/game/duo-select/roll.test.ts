import { describe, expect, it } from "vitest";
import type { ChartNote } from "../../contracts";
import { handL, handR } from "../ui-tokens";
import { EMPTY_ROLL, roll } from "./roll";

const note = (beat: number, pitch: number, hand: "R" | "L" = "R", duration = 1): ChartNote => ({
  id: `${beat}-${pitch}`,
  pitch,
  beat,
  duration,
  hand,
});

describe("roll", () => {
  it("gives one bar per note in the window, each at its pitch row in its hand's color", () => {
    const notes = [note(0, 60), note(1, 64), note(2, 48, "L", 2), note(4, 67)];
    const r = roll({ beatsPerBar: 4, notes });
    expect(r.bars).toHaveLength(4);
    expect(r.rows).toBe(67 - 48 + 1);
    expect(r.bars.map((b) => b.row)).toEqual([12, 16, 0, 19]);
    expect(r.bars.map((b) => b.color)).toEqual([handR, handR, handL, handR]);
    expect(r.bars[2]).toMatchObject({ hand: "L", x: 2 / 8, w: 2 / 8 });
    expect(r.barLines).toEqual([0.5]); // two bars: the song ends in its second
  });

  it("shows the first 8 bars, and cuts a note at the window's end", () => {
    const notes = [note(0, 60), note(31, 62, "R", 4), note(32, 64), note(40, 65)];
    const r = roll({ beatsPerBar: 4, notes });
    expect(r.bars.map((b) => b.row)).toEqual([0, 2]); // beats 32 and 40 are bar 9 on
    expect(r.bars[1].x + r.bars[1].w).toBe(1);
    expect(r.barLines).toHaveLength(7);
  });

  it("starts at a pickup's bar, so the pickup isn't cut off", () => {
    const r = roll({ beatsPerBar: 3, notes: [note(-1, 60), note(0, 62)] });
    expect(r.bars[0].x).toBeCloseTo(2 / 6);
    expect(r.barLines).toEqual([0.5]);
  });

  it("gives an empty roll for an empty chart", () => {
    expect(roll({ beatsPerBar: 4, notes: [] })).toEqual(EMPTY_ROLL);
  });
});
