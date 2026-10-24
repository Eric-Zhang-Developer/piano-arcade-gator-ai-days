// The spec's synthetic players, against the real Twinkle chart.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent, Take, TakeEvent } from "../../contracts";
import { Judge, judgeTake, noteTimeMs } from "./judge";

const chart: Chart = JSON.parse(
  readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"),
);

// One take event per chart note; `shift` returns the offset in ms, or null to skip the note.
function play(shift: (i: number) => number | null, pitchFor = (i: number) => chart.notes[i].pitch): Take {
  const events: TakeEvent[] = [];
  chart.notes.forEach((n, i) => {
    const s = shift(i);
    if (s !== null) events.push({ pitch: pitchFor(i), velocity: 80, timeMs: noteTimeMs(chart, n) + s, offTimeMs: null });
  });
  return { chartId: chart.id, startedAt: new Date(0).toISOString(), latencyOffsetMs: 0, inputDevice: "test", events };
}

describe("synthetic players on Twinkle", () => {
  const N = chart.notes.length;

  it("Perfect: all PERFECT, 100%, rank S, full combo", () => {
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e));
    play(() => 0).events.forEach((e, i) => judge.press(e.pitch, e.timeMs, i));
    const r = judge.finish(1e9);
    expect(r.counts).toEqual({ PERFECT: N, GREAT: 0, MISS: 0, extra: 0 });
    expect(r.accuracy).toBe(1);
    expect(r.rank).toBe("S");
    expect(r.maxCombo).toBe(N);
    expect(events.map((e) => e.type).slice(-2)).toEqual(["fullCombo", "songEnd"]);
  });

  it("Skipper: dropping notes 3 and 10 gives exactly 2 MISS, 0 extras", () => {
    const r = judgeTake(chart, play((i) => (i === 2 || i === 9 ? null : 0)));
    expect(r.counts.MISS).toBe(2);
    expect(r.counts.extra).toBe(0);
    expect(r.judgments[2].judgment).toBe("MISS");
    expect(r.judgments[9].judgment).toBe("MISS");
  });

  it("Late40: every note at +40 ms is GREAT", () => {
    const r = judgeTake(chart, play(() => 40));
    expect(r.counts).toEqual({ PERFECT: 0, GREAT: N, MISS: 0, extra: 0 });
    expect(r.judgments.every((j) => j.offsetMs === 40)).toBe(true);
  });

  it("Boundary: +25 PERFECT, -50 GREAT, +51 MISS plus an extra", () => {
    const shifts: Record<number, number> = { 0: 25, 1: -50, 2: 51 };
    const r = judgeTake(chart, play((i) => shifts[i] ?? 0));
    expect(r.judgments.slice(0, 3).map((j) => j.judgment)).toEqual(["PERFECT", "GREAT", "MISS"]);
    expect(r.judgments[1].offsetMs).toBe(-50);
    expect(r.counts.MISS).toBe(1);
    expect(r.counts.extra).toBe(1);
  });

  it("Wrong pitch: one note a semitone off is a MISS plus an extra", () => {
    const r = judgeTake(chart, play(() => 0, (i) => chart.notes[i].pitch + (i === 4 ? 1 : 0)));
    expect(r.judgments[4].judgment).toBe("MISS");
    expect(r.counts).toEqual({ PERFECT: N - 1, GREAT: 0, MISS: 1, extra: 1 });
  });
});

// A synthetic chart: one C4 per beat at 100 BPM (600 ms apart).
const synth = (n: number): Chart => ({
  id: "synth",
  title: "synth",
  composer: "test",
  source: "test",
  bpm: 100,
  beatsPerBar: 4,
  notes: Array.from({ length: n }, (_, i) => ({ id: `n${i}`, pitch: 60, beat: i, duration: 1, hand: "R" as const })),
});

describe("live judging", () => {
  it("press and advance emit events in order", () => {
    const events: GameEvent[] = [];
    const judge = new Judge(synth(3), (e) => events.push(e));
    judge.press(60, 10, 0); // note 0, +10
    judge.press(72, 300, 1); // no such pitch: extra
    judge.advance(650); // note 1 at 600 is still open (600 + 50 is not < 650)
    expect(judge.noteState.has("n1")).toBe(false);
    judge.advance(651);
    judge.press(60, 1190, 2); // note 2 at 1200, -10
    expect(events.map((e) => e.type)).toEqual(["noteHit", "combo", "extra", "noteMiss", "noteHit", "combo"]);
    expect(events[3]).toMatchObject({ noteId: "n1", atMs: 650 });
    expect(judge.noteState.get("n1")).toBe("MISS");
    const r = judge.finish(2000);
    expect(r.counts).toEqual({ PERFECT: 2, GREAT: 0, MISS: 1, extra: 1 });
    expect(r.maxCombo).toBe(1);
    expect(judge.finish(3000)).toBe(r); // idempotent
  });

  it("combo milestones at 25 and 50, fever from 50 to the next MISS", () => {
    const c = synth(60);
    const events: GameEvent[] = [];
    const judge = new Judge(c, (e) => events.push(e));
    for (let i = 0; i < 55; i++) judge.press(60, noteTimeMs(c, c.notes[i]), i);
    judge.finish(1e9); // notes 56–60 miss
    expect(events.filter((e) => e.type === "comboMilestone").map((e) => (e as { count: number }).count)).toEqual([25, 50]);
    const types = events.map((e) => e.type);
    expect(types.filter((t) => t === "feverStart")).toHaveLength(1);
    expect(types.indexOf("feverEnd")).toBe(types.indexOf("noteMiss") + 1);
    expect(types).not.toContain("fullCombo");
  });

  it("matches the nearest open note of the same pitch", () => {
    const c: Chart = { ...synth(2), notes: [
      { id: "a", pitch: 60, beat: 0, duration: 1, hand: "R" },
      { id: "b", pitch: 60, beat: 0.1, duration: 1, hand: "R" }, // 60 ms later
    ] };
    const r = judgeTake(c, { chartId: "synth", startedAt: new Date(0).toISOString(), latencyOffsetMs: 0,
      inputDevice: "test", events: [{ pitch: 60, velocity: 80, timeMs: 45, offTimeMs: null }] });
    expect(r.judgments.map((j) => j.judgment)).toEqual(["MISS", "PERFECT"]);
  });
});
