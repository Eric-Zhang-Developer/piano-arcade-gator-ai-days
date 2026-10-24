import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { makeLayout } from "../core/highway";
import { Judge } from "../core/judge";
import { msPerBeat } from "../core/settings";
import { emptyHud, hudBottom, hudLayout, reduceHud, tierFor, tierProgress } from ".";

// What the judge sends for a hit: noteHit, then combo, then comboMilestone at 25.
function hits(judgment: "PERFECT" | "GREAT", n: number, comboBefore: number): GameEvent[] {
  return Array.from({ length: n }, (_, i): GameEvent[] => {
    const count = comboBefore + i + 1;
    const ev: GameEvent[] = [
      { type: "noteHit", noteId: `${judgment}${i}`, pitch: 60, judgment, offsetMs: 0, atMs: count },
      { type: "combo", count, atMs: count },
    ];
    return count === 25 ? [...ev, { type: "comboMilestone", count, atMs: count }] : ev;
  }).flat();
}

// x1 for hits 1-10, then x2, x3 (each hit scores at the combo before it).
const EXPECTED = { PERFECT: 10, GREAT: 25, MISS: 1, extra: 0, combo: 25, score: 10 * 100 + 10 * 50 + 10 * 100 + 5 * 150 };

describe("reduceHud", () => {
  it("10 PERFECT, 1 MISS, 25 GREAT: exact counters, combo, multiplier and score", () => {
    const events: GameEvent[] = [
      { type: "songStart", atMs: -4800 },
      ...hits("PERFECT", 10, 0),
      { type: "noteMiss", noteId: "m", pitch: 60, atMs: 100 },
      ...hits("GREAT", 25, 0),
    ];
    const s = events.reduce(reduceHud, emptyHud());
    expect(s).toMatchObject(EXPECTED);
    expect(s.score).toBe(3250);
    expect(tierFor(s.combo).mult).toBe(3);
    expect(tierProgress(s.combo)).toEqual({ filled: 5, of: 10 });
    expect(s.milestone).toEqual({ count: 25, atMs: 25 });
  });

  it("gets the same numbers from the real judge's events", () => {
    const bpm = 120;
    const chart: Chart = {
      id: "t",
      title: "t",
      composer: "t",
      source: "test",
      bpm,
      beatsPerBar: 4,
      notes: Array.from({ length: 36 }, (_, i) => ({ id: `n${i}`, pitch: 60, beat: i, duration: 1, hand: "R" as const })),
    };
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e));
    const mpb = msPerBeat(bpm);
    chart.notes.forEach((n, i) => {
      if (i !== 10) judge.press(n.pitch, n.beat * mpb + (i < 10 ? 0 : 40), i); // 0 ms is PERFECT, 40 ms GREAT; 10 is the MISS
      judge.advance(n.beat * mpb + 60);
    });
    judge.finish(36 * mpb);
    expect(events.reduce(reduceHud, emptyHud())).toMatchObject(EXPECTED);
  });

  it("counts extras without touching the combo, and resets on songStart", () => {
    let s = hits("PERFECT", 7, 0).reduce(reduceHud, emptyHud());
    s = reduceHud(s, { type: "extra", pitch: 61, atMs: 900 });
    expect(s).toMatchObject({ extra: 1, combo: 7, PERFECT: 7 });
    expect(reduceHud(s, { type: "songStart", atMs: 0 })).toEqual(emptyHud());
  });

  it("GOOD keeps the combo and scores 25 x the multiplier; a WRONG note breaks the combo", () => {
    let s = hits("PERFECT", 12, 0).reduce(reduceHud, emptyHud()); // combo 12: x2
    s = reduceHud(s, { type: "noteHit", noteId: "g", pitch: 60, judgment: "GOOD", offsetMs: 80, atMs: 13 });
    s = reduceHud(s, { type: "combo", count: 13, atMs: 13 });
    expect(s).toMatchObject({ GOOD: 1, combo: 13, score: 10 * 100 + 2 * 200 + 25 * 2 });
    s = reduceHud(reduceHud(s, { type: "extra", pitch: 30, atMs: 14 }), { type: "wrongNote", pitch: 30, atMs: 14 });
    expect(s).toMatchObject({ extra: 1, wrong: 1, combo: 0 });
  });

  it("tiers: x1 from 0, x2 from 10, x3 from 20, x4 from 30, each its own color", () => {
    expect([0, 9, 10, 19, 20, 29, 30, 99].map((c) => tierFor(c).mult)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(new Set([0, 10, 20, 30].map((c) => tierFor(c).color)).size).toBe(4);
    expect(tierProgress(30)).toEqual({ filled: 10, of: 10 });
  });
});

describe("hudLayout", () => {
  const chart: Chart = {
    id: "t",
    title: "t",
    composer: "t",
    source: "test",
    bpm: 100,
    beatsPerBar: 4,
    notes: [60, 62, 64, 65, 67, 69, 71, 72].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" as const })),
  };
  it.each([
    [1280, 720],
    [1920, 1080],
    [800, 600],
    [1280, 400],
    [375, 812],
    [2560, 1440],
  ])("stays out of the lowest 40%% of the highway at %ix%i", (w, h) => {
    const line = makeLayout(chart, w, h, 0).judgmentLineY;
    const l = hudLayout(w, line);
    expect(hudBottom(l)).toBeLessThanOrEqual(l.safeY);
    expect(l.safeY).toBeCloseTo(line * 0.6);
  });
});
