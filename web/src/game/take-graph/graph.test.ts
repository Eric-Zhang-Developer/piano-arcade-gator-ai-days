import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Take, TakeEvent } from "../../contracts";
import { loopChart } from "../bar-loop";
import { judgeTake, noteTimeMs } from "../core/judge";
import { GOOD_MS, GREAT_MS, PERFECT_MS } from "../core/settings";
import {
  bands,
  barAndBeat,
  barTicks,
  clipOffset,
  describePoint,
  graphPoints,
  rollingMedian,
  sensesVelocity,
  stepTo,
  timeOrder,
  trendLabel,
  velocityStrip,
  wrongMarks,
  type GraphPoint,
} from "./graph";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

// Every note played `offset(i)` ms off (null skips it), at velocity 40 + i; plus any extra events.
function take(chart: Chart, offset: (i: number) => number | null, inputDevice: Take["inputDevice"] = "test", extra: TakeEvent[] = []): Take {
  const events: TakeEvent[] = [];
  chart.notes.forEach((n, i) => {
    const o = offset(i);
    if (o !== null) events.push({ pitch: n.pitch, velocity: 40 + i, timeMs: noteTimeMs(chart, n) + o, offTimeMs: null });
  });
  return { chartId: chart.id, startedAt: new Date(0).toISOString(), latencyOffsetMs: 0, inputDevice, events: [...events, ...extra] };
}

describe("graphPoints", () => {
  it("in 4/4, beat 5 is bar 2, beat 2", () => {
    expect(barAndBeat(5, 4)).toEqual({ bar: 2, beat: 2 });
    expect(barAndBeat(0, 4)).toEqual({ bar: 1, beat: 1 });
    expect(barAndBeat(6.5, 3)).toEqual({ bar: 3, beat: 1.5 });
  });

  it("gives one point per chart note: a MISS has a null offset, a hit its event's velocity", () => {
    const t = take(twinkle, (i) => (i === 3 ? null : i % 2 ? 60 : -10));
    const r = judgeTake(twinkle, t);
    const pts = graphPoints(twinkle, t, r);
    expect(pts).toHaveLength(twinkle.notes.length);
    expect(pts[3]).toMatchObject({ judgment: "MISS", offsetMs: null, velocity: null });
    expect(pts[1]).toMatchObject({ judgment: "GREAT", offsetMs: 60, velocity: 41 });
    for (const p of pts.filter((p) => p.offsetMs !== null)) {
      const j = r.judgments.find((j) => j.noteId === p.noteId)!;
      expect(p.velocity).toBe(t.events[j.eventIndex!].velocity);
    }
  });

  it("names a note like the readout: bar, beat, offset, judgment, velocity", () => {
    const p = { noteId: "n", x: 1.25, bar: 2, beat: 2, hand: "R" as const, judgment: "GREAT" as const, offsetMs: 32, velocity: 74 };
    expect(describePoint(p, true)).toBe("Bar 2 · beat 2 · +32 ms · GREAT · vel 74");
    expect(describePoint(p, false)).toBe("Bar 2 · beat 2 · +32 ms · GREAT");
    expect(describePoint({ ...p, offsetMs: -7.4 }, false)).toBe("Bar 2 · beat 2 · −7 ms · GREAT");
    expect(describePoint({ ...p, offsetMs: null, judgment: "MISS", velocity: null }, true)).toBe("Bar 2 · beat 2 · MISS");
  });

  it("a laptop take gives no velocity line; MIDI and test input do", () => {
    expect(sensesVelocity(take(twinkle, () => 0, "keys"))).toBe(false);
    expect(sensesVelocity(take(twinkle, () => 0, "midi"))).toBe(true);
    expect(sensesVelocity(take(twinkle, () => 0, "test"))).toBe(true);
  });

  it("places a WRONG note by its time, in bars", () => {
    const at = noteTimeMs(twinkle, twinkle.notes[8]) - 300; // 300 ms before a note, far from any of its pitch
    const t = take(twinkle, () => 0, "test", [{ pitch: 30, velocity: 80, timeMs: at, offTimeMs: null }]);
    const r = judgeTake(twinkle, t);
    expect(r.wrong).toHaveLength(1);
    const barMs = (60000 / twinkle.bpm) * twinkle.beatsPerBar;
    expect(wrongMarks(twinkle, t, r)).toEqual([at / barMs]);
  });

  it("bar-loop's looped chart still gives one point per looped note", () => {
    const looped = loopChart(twinkle, new URLSearchParams("from=1&to=2&passes=3"))!.chart;
    const t = take(looped, () => 0);
    const pts = graphPoints(looped, t, judgeTake(looped, t));
    expect(pts).toHaveLength(looped.notes.length);
    expect(pts.every((p) => p.judgment === "PERFECT")).toBe(true);
  });
});

// A scripted hit: hand, offset, at x bars. Velocity 64 unless given.
const pt = (i: number, hand: "R" | "L", offsetMs: number | null, x = i / 4, velocity: number | null = 64): GraphPoint => ({
  noteId: `p${i}`,
  x,
  bar: Math.floor(x) + 1,
  beat: (x % 1) * 4 + 1,
  hand,
  judgment: offsetMs === null ? "MISS" : "PERFECT",
  offsetMs,
  velocity: offsetMs === null ? null : velocity,
});

describe("take-graph-pass", () => {
  it("the bands follow the judge: the default is core's windows, and other windows move them", () => {
    expect(bands().map((b) => [b.judgment, b.ms])).toEqual([
      ["GOOD", GOOD_MS],
      ["GREAT", GREAT_MS],
      ["PERFECT", PERFECT_MS],
    ]);
    expect(bands({ perfect: 25, great: 50, good: 100 }).map((b) => b.ms)).toEqual([100, 50, 25]);
  });

  it("an offset past GOOD is pinned to the edge and marked, and the readout keeps its true value", () => {
    expect(clipOffset(60)).toEqual({ ms: 60, clipped: false });
    expect(clipOffset(-GOOD_MS)).toEqual({ ms: -GOOD_MS, clipped: false });
    expect(clipOffset(180)).toEqual({ ms: GOOD_MS, clipped: true });
    expect(clipOffset(-150, { perfect: 25, great: 50, good: 100 })).toEqual({ ms: -100, clipped: true });
    expect(describePoint({ ...pt(0, "R", 180), judgment: "GOOD" }, false)).toContain("+180 ms");
  });

  it("the rolling median, by hand: each run of 8 hits' median at the run's middle", () => {
    // Right hand: 0, 10, 20 … 90 ms over ten hits, every quarter bar; a left hand and a miss in between change nothing.
    const right = Array.from({ length: 10 }, (_, i) => pt(i, "R", i * 10));
    const pts = [...right, pt(20, "L", -50, 0.6), pt(21, "R", null, 0.7)];
    // Runs: hits 0–7 (median of 0…70 is 35), 1–8 (45), 2–9 (55); each at the middle of its 4th and 5th hit's x.
    expect(rollingMedian(pts, "R")).toEqual([
      { x: (0.75 + 1) / 2, ms: 35 },
      { x: (1 + 1.25) / 2, ms: 45 },
      { x: (1.25 + 1.5) / 2, ms: 55 },
    ]);
    expect(trendLabel(rollingMedian(pts, "R"), "R")).toBe("RH +55 ms late");
    expect(trendLabel([{ ms: -4.2 }], "L")).toBe("LH −4 ms early");
    expect(trendLabel([{ ms: 0.3 }], "L")).toBe("LH ±0 ms on time");
  });

  it("a hand with fewer than 8 hits gets no trend and no label", () => {
    const pts = Array.from({ length: 7 }, (_, i) => pt(i, "L", 5));
    expect(rollingMedian(pts, "L")).toEqual([]);
    expect(trendLabel(rollingMedian(pts, "L"), "L")).toBeNull();
  });

  it("the bar ticks: a gridline per bar, numbers every 4 bars, sparser when the plot is narrow", () => {
    const wide = barTicks(16, 1600);
    expect(wide.lines).toHaveLength(17);
    expect(wide.labels.map((l) => l.bar)).toEqual([1, 5, 9, 13]);
    // 64 bars in 600 px is 9.4 px a bar: every 4 bars is 37.5 px, enough room.
    expect(barTicks(64, 600).labels.map((l) => l.bar).slice(0, 3)).toEqual([1, 5, 9]);
    // 64 bars in 300 px: every 8 bars.
    expect(barTicks(64, 300).labels.map((l) => l.bar).slice(0, 3)).toEqual([1, 9, 17]);
  });

  it("the velocity strip: hits with a velocity, by time", () => {
    const pts = [pt(1, "R", 0, 0.5, 90), pt(0, "L", 0, 0.25, 40), pt(2, "R", null, 0.75), pt(3, "R", 0, 1, null)];
    expect(velocityStrip(pts)).toEqual([
      { x: 0.25, hand: "L", velocity: 40 },
      { x: 0.5, hand: "R", velocity: 90 },
    ]);
  });

  it("the arrow keys step through notes in time order, the right hand first in a chord; Home and End jump", () => {
    const pts = [pt(0, "L", 0, 1), pt(1, "R", 0, 0), pt(2, "R", 0, 1), pt(3, "L", null, 0.5)];
    const order = timeOrder(pts);
    expect(order).toEqual([1, 3, 2, 0]);
    expect(stepTo(order, null, "ArrowRight")).toBe(1);
    expect(stepTo(order, 1, "ArrowRight")).toBe(3);
    expect(stepTo(order, 3, "ArrowLeft")).toBe(1);
    expect(stepTo(order, 1, "ArrowLeft")).toBe(1);
    expect(stepTo(order, 0, "ArrowRight")).toBe(0);
    expect(stepTo(order, 3, "Home")).toBe(1);
    expect(stepTo(order, null, "End")).toBe(0);
  });
});
