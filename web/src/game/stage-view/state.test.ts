import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import type { SheetMessage } from "../sheet-view/plugin";
import { emptyStage, onLane, reduceStage } from "./state";

// 120 BPM: a beat is 500 ms, so n1..n4 are due at 0, 500, 1000 and 1500 ms.
const chart: Chart = {
  id: "t",
  title: "T",
  composer: "C",
  source: "test",
  bpm: 120,
  beatsPerBar: 4,
  notes: [0, 1, 2, 3].map((b) => ({ id: `n${b + 1}`, pitch: 60 + b, beat: b, duration: 1, hand: b % 2 ? ("L" as const) : ("R" as const) })),
};
const run = (ms: SheetMessage[]) => ms.reduce(reduceStage, emptyStage);

describe("stage-view's state", () => {
  it("waits with no take, and the latest take starts it clean", () => {
    expect(emptyStage.chart).toBeNull();
    const s = run([{ type: "take", chart }, { type: "clock", nowMs: 100 }, { type: "judgment", noteId: "n1", judgment: "GOOD" }, { type: "take", chart }]);
    expect(s.chart).toBe(chart);
    expect(s.nowMs).toBeNull();
    expect(s.judged.size).toBe(0);
    expect(s.hits).toEqual([]);
  });

  it("follows the clock: notes on the lane, combo, milestones, full combo and the end", () => {
    const s0 = run([{ type: "take", chart }, { type: "clock", nowMs: -400 }]);
    expect(onLane(s0, 1000).map((n) => [n.id, Math.round(n.t * 1000) / 1000])).toEqual([["n1", 0.6], ["n2", 0.1]]);

    const s1 = run([
      { type: "take", chart },
      { type: "clock", nowMs: 2 },
      { type: "judgment", noteId: "n1", judgment: "PERFECT" },
      { type: "combo", count: 1 },
      { type: "clock", nowMs: 505 },
      { type: "judgment", noteId: "n2", judgment: "GREAT" },
      { type: "combo", count: 2 },
      { type: "milestone", count: 2 },
      { type: "clock", nowMs: 900 },
    ]);
    expect(s1.combo).toBe(2);
    expect(s1.hits.map((h) => [h.noteId, h.judgment, h.atMs])).toEqual([["n1", "PERFECT", 2], ["n2", "GREAT", 505]]);
    expect(s1.milestone).toEqual({ count: 2, atMs: 505 });
    expect(onLane(s1, 1000).map((n) => n.id)).toEqual(["n3", "n4"]); // judged notes leave the lane

    const s2 = [
      { type: "judgment", noteId: "n3", judgment: "MISS" },
      { type: "combo", count: 0 },
      { type: "clock", nowMs: 1600 },
      { type: "fullCombo" },
      { type: "end" },
    ].reduce((s, m) => reduceStage(s, m as SheetMessage), s1);
    expect(s2.combo).toBe(0);
    expect(s2.fullCombo).toEqual({ atMs: 1600 });
    expect(s2.ended).toEqual({ atMs: 1600 });
  });

  it("drops hit effects older than 2 s, and ignores messages it doesn't read", () => {
    const s = run([{ type: "take", chart }, { type: "clock", nowMs: 0 }, { type: "judgment", noteId: "n1", judgment: "PERFECT" }, { type: "clock", nowMs: 2500 }]);
    expect(s.hits).toEqual([]);
    expect(reduceStage(s, { type: "pedal" } as unknown as SheetMessage)).toBe(s);
  });
});
