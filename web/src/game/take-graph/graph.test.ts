import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Take, TakeEvent } from "../../contracts";
import { loopChart } from "../bar-loop";
import { judgeTake, noteTimeMs } from "../core/judge";
import { barAndBeat, describePoint, graphPoints, sensesVelocity, wrongMarks } from "./graph";

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
    const t = take(twinkle, (i) => (i === 3 ? null : i % 2 ? 32 : -10));
    const r = judgeTake(twinkle, t);
    const pts = graphPoints(twinkle, t, r);
    expect(pts).toHaveLength(twinkle.notes.length);
    expect(pts[3]).toMatchObject({ judgment: "MISS", offsetMs: null, velocity: null });
    expect(pts[1]).toMatchObject({ judgment: "GREAT", offsetMs: 32, velocity: 41 });
    for (const p of pts.filter((p) => p.offsetMs !== null)) {
      const j = r.judgments.find((j) => j.noteId === p.noteId)!;
      expect(p.velocity).toBe(t.events[j.eventIndex!].velocity);
    }
  });

  it("names a dot like the spec: bar, beat, offset, judgment, velocity", () => {
    const p = { noteId: "n", x: 1.25, bar: 2, beat: 2, hand: "R" as const, judgment: "GREAT" as const, offsetMs: 32, velocity: 74 };
    expect(describePoint(p, true)).toBe("Bar 2, beat 2 · +32 ms · GREAT · velocity 74");
    expect(describePoint(p, false)).toBe("Bar 2, beat 2 · +32 ms · GREAT");
    expect(describePoint({ ...p, offsetMs: null, judgment: "MISS", velocity: null }, true)).toBe("Bar 2, beat 2 · MISS");
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
