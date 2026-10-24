import { describe, expect, it } from "vitest";
import { stepFocus, tickSchedule } from "./schedule";

describe("pause skin", () => {
  it("clicks 4 beats at 500 ms at 0, 500, 1000 and 1500 ms, the first accented", () => {
    expect(tickSchedule(4, 500)).toEqual([
      { atMs: 0, accent: true },
      { atMs: 500, accent: false },
      { atMs: 1000, accent: false },
      { atMs: 1500, accent: false },
    ]);
  });

  it("clicks 3 beats as three ticks, and none for 0", () => {
    expect(tickSchedule(3, 600).map((t) => t.atMs)).toEqual([0, 600, 1200]);
    expect(tickSchedule(0, 600)).toEqual([]);
  });

  it("↑/↓ stop at the ends: ↓ on Quit stays on Quit, ↑ on Resume stays on Resume", () => {
    expect(stepFocus(0, 1, 3)).toBe(1);
    expect(stepFocus(2, 1, 3)).toBe(2);
    expect(stepFocus(0, -1, 3)).toBe(0);
  });
});
