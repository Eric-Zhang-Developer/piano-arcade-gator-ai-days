import { describe, expect, it } from "vitest";
import type { Chart, Judgment } from "../../contracts";
import { Judge } from "../core/judge";
import { holdClock, shouldHold } from ".";
import { modeUrl } from "./plugin";

// 60 bpm: beat n is at n * 1000 ms. A note at beat 1, a two-hand chord at beat 2.
const chart: Chart = {
  id: "t",
  title: "t",
  bpm: 60,
  beatsPerBar: 4,
  notes: [
    { id: "a", pitch: 60, beat: 1, duration: 1, hand: "R" },
    { id: "b", pitch: 64, beat: 2, duration: 1, hand: "R" },
    { id: "c", pitch: 48, beat: 2, duration: 1, hand: "L" },
  ],
} as Chart;

describe("shouldHold", () => {
  it("holds at a note's time until it's pressed", () => {
    const state = new Map<string, Judgment>();
    expect(shouldHold(chart, state, 999)).toBeNull();
    expect(shouldHold(chart, state, 1000)).toBe(1000);
    expect(shouldHold(chart, state, 1500)).toBe(1000);
    state.set("a", "PERFECT");
    expect(shouldHold(chart, state, 1500)).toBeNull(); // between notes
  });

  it("holds at a chord until every pitch is pressed", () => {
    const state = new Map<string, Judgment>([["a", "PERFECT"]]);
    expect(shouldHold(chart, state, 2000)).toBe(2000);
    state.set("b", "GOOD");
    expect(shouldHold(chart, state, 2000)).toBe(2000);
    state.set("c", "GREAT");
    expect(shouldHold(chart, state, 2000)).toBeNull();
  });
});

describe("holdClock", () => {
  it("stops on the note, judges a late press at offset 0, then plays on from the note", () => {
    const judge = new Judge(chart);
    const clock = holdClock(chart, judge.noteState);
    clock.update(500);
    expect(clock.now(500)).toBe(500);
    clock.update(4000); // a frame 3 s after note a reached the line
    expect(clock.holding).toBe(true);
    expect(clock.now(4000)).toBe(1000);
    judge.press(60, clock.now(4000), 0);
    expect(judge.noteState.get("a")).toBe("PERFECT");
    clock.update(4000);
    expect(clock.holding).toBe(false);
    expect(clock.now(4500)).toBe(1500); // the 3 s held is gone from the chart clock
    expect(clock.toOuter(2000)).toBe(5000);
  });

  it("waits at a chord for both keys", () => {
    const judge = new Judge(chart);
    const clock = holdClock(chart, judge.noteState);
    judge.press(60, 1000, 0);
    clock.update(2100);
    expect(clock.now(2100)).toBe(2000);
    judge.press(64, clock.now(2100), 1);
    clock.update(2200);
    expect(clock.holding).toBe(true);
    judge.press(48, clock.now(2200), 2);
    clock.update(2200);
    expect(clock.holding).toBe(false);
    expect(judge.finish(3000).judgments.map((j) => j.offsetMs)).toEqual([0, 0, 0]);
  });
});

describe("modeUrl", () => {
  it("adds mode=wait and takes it away, keeping every other param", () => {
    const p = new URLSearchParams("song=fur-elise&hands=R&from=1&to=2");
    expect(modeUrl(p, true)).toBe("/play?song=fur-elise&hands=R&from=1&to=2&mode=wait");
    expect(modeUrl(new URLSearchParams(modeUrl(p, true).slice(6)), false)).toBe("/play?song=fur-elise&hands=R&from=1&to=2");
  });
});
