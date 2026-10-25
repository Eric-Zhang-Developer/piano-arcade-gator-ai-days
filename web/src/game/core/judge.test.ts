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

  it("Perfect: fever starts once, on the 12th note (the fever gauge)", () => {
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e));
    play(() => 0).events.forEach((e, i) => judge.press(e.pitch, e.timeMs, i));
    judge.finish(1e9);
    const types = events.map((e) => e.type);
    expect(types.filter((t) => t === "feverStart")).toHaveLength(1);
    expect(events[types.indexOf("feverStart") - 1]).toMatchObject({ type: "combo", count: 12 });
    expect(types).not.toContain("feverEnd");
  });

  it("Perfect: all PERFECT, 100%, rank S, full combo", () => {
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e));
    play(() => 0).events.forEach((e, i) => judge.press(e.pitch, e.timeMs, i));
    const r = judge.finish(1e9);
    expect(r.counts).toEqual({ PERFECT: N, GREAT: 0, GOOD: 0, MISS: 0, extra: 0, wrong: 0 });
    expect(r.accuracy).toBe(1);
    expect(r.rank).toBe("S");
    expect(r.maxCombo).toBe(N);
    expect(events.map((e) => e.type).slice(-2)).toEqual(["fullCombo", "songEnd"]);
  });

  it("Skipper: dropping notes 3 and 10 gives exactly 2 MISS, 0 WRONG, 0 extras", () => {
    const r = judgeTake(chart, play((i) => (i === 2 || i === 9 ? null : 0)));
    expect(r.counts.MISS).toBe(2);
    expect(r.counts.wrong).toBe(0);
    expect(r.counts.extra).toBe(0);
    expect(r.judgments[2].judgment).toBe("MISS");
    expect(r.judgments[9].judgment).toBe("MISS");
  });

  it("Late60: every note at +60 ms is GREAT, 80%", () => {
    const r = judgeTake(chart, play(() => 60));
    expect(r.counts).toEqual({ PERFECT: 0, GREAT: N, GOOD: 0, MISS: 0, extra: 0, wrong: 0 });
    expect(r.judgments.every((j) => j.offsetMs === 60)).toBe(true);
    expect(r.accuracy).toBe(0.8);
  });

  it("Late100: every note at +100 ms is GOOD, 50%, and the full combo floors the rank at B", () => {
    const r = judgeTake(chart, play(() => 100));
    expect(r.counts).toEqual({ PERFECT: 0, GREAT: 0, GOOD: N, MISS: 0, extra: 0, wrong: 0 });
    expect(r.accuracy).toBe(0.5);
    expect(r.rank).toBe("B");
    expect(r.maxCombo).toBe(N);
  });

  it("Late100 with one skipped note: no full combo, so no floor: rank D", () => {
    const r = judgeTake(chart, play((i) => (i === 5 ? null : 100)));
    expect(r.counts).toMatchObject({ GOOD: N - 1, MISS: 1 });
    expect(r.rank).toBe("D");
  });

  it("Eric's take's mix (18 PERFECT, 18 GREAT, 6 GOOD of 42, no miss): 84.3%, B", () => {
    const r = judgeTake(chart, play((i) => (i < 18 ? 0 : i < 36 ? 60 : 100)));
    expect(r.counts).toEqual({ PERFECT: 18, GREAT: 18, GOOD: 6, MISS: 0, extra: 0, wrong: 0 });
    expect(r.accuracy).toBeCloseTo(35.4 / 42, 10);
    expect(r.rank).toBe("B");
  });

  it("Boundary: +40 PERFECT, -80 GREAT, +81 GOOD, +120 GOOD, +121 MISS plus an extra that isn't WRONG", () => {
    const shifts: Record<number, number> = { 0: 40, 1: -80, 2: 81, 3: 120, 4: 121 };
    const r = judgeTake(chart, play((i) => shifts[i] ?? 0));
    expect(r.judgments.slice(0, 5).map((j) => j.judgment)).toEqual(["PERFECT", "GREAT", "GOOD", "GOOD", "MISS"]);
    expect(r.judgments[1].offsetMs).toBe(-80);
    expect(r.counts).toMatchObject({ MISS: 1, extra: 1, wrong: 0 });
  });

  it("Wrong pitch: a semitone off is a MISS and a WRONG note; accuracy 41/43; the combo breaks there", () => {
    const events: GameEvent[] = [];
    const r = judgeTake(chart, play(() => 0, (i) => chart.notes[i].pitch + (i === 4 ? 1 : 0)));
    expect(r.judgments[4].judgment).toBe("MISS");
    expect(r.counts).toEqual({ PERFECT: N - 1, GREAT: 0, GOOD: 0, MISS: 1, extra: 1, wrong: 1 });
    expect(r.accuracy).toBe((N - 1) / (N + 1));
    expect(r.maxCombo).toBe(N - 5); // notes 6..42 after the break
    const judge = new Judge(chart, (e) => events.push(e));
    const t = noteTimeMs(chart, chart.notes[4]);
    judge.press(chart.notes[4].pitch + 1, t, 0);
    // notes 1–4 were never pressed: the press misses them first (#586), then it's an extra and a WRONG note
    expect(events.map((e) => e.type)).toEqual(["noteMiss", "noteMiss", "noteMiss", "noteMiss", "extra", "wrongNote"]);
  });

  it("Wrong then right: a wrong key 30 ms early, then the right key on time: PERFECT, 1 WRONG, combo reset", () => {
    const n = chart.notes[10];
    const t = noteTimeMs(chart, n);
    const take = play(() => 0);
    take.events.push({ pitch: n.pitch + 1, velocity: 80, timeMs: t - 30, offTimeMs: null });
    const r = judgeTake(chart, take);
    expect(r.judgments[10].judgment).toBe("PERFECT");
    expect(r.counts.wrong).toBe(1);
    expect(r.maxCombo).toBe(N - 10); // 11..42 continue after the reset; 1..10 before it
  });

  it("Count-in press: a key 1000 ms before the first note is an extra, not WRONG", () => {
    const take = play(() => 0);
    take.events.push({ pitch: 50, velocity: 80, timeMs: -1000, offTimeMs: null });
    const r = judgeTake(chart, take);
    expect(r.counts).toMatchObject({ extra: 1, wrong: 0, PERFECT: N });
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
    judge.press(72, 300, 1); // no such pitch, mid-song: an extra and a WRONG note
    judge.advance(720); // note 1 at 600 is still open (600 + 120 is not < 720)
    expect(judge.noteState.has("n1")).toBe(false);
    judge.advance(721);
    judge.press(60, 1190, 2); // note 2 at 1200, -10
    expect(events.map((e) => e.type)).toEqual(["noteHit", "combo", "extra", "wrongNote", "noteMiss", "noteHit", "combo"]);
    expect(events[4]).toMatchObject({ noteId: "n1", atMs: 720 });
    expect(judge.noteState.get("n1")).toBe("MISS");
    const r = judge.finish(2000);
    expect(r.counts).toEqual({ PERFECT: 2, GREAT: 0, GOOD: 0, MISS: 1, extra: 1, wrong: 1 });
    expect(r.maxCombo).toBe(1);
    expect(judge.finish(3000)).toBe(r); // idempotent
  });

  it("combo milestones at 25 and 50, fever from a full gauge (15 for 60 notes) to the next MISS", () => {
    const c = synth(60);
    const events: GameEvent[] = [];
    const judge = new Judge(c, (e) => events.push(e));
    for (let i = 0; i < 55; i++) judge.press(60, noteTimeMs(c, c.notes[i]), i);
    judge.finish(1e9); // notes 56–60 miss
    expect(events.filter((e) => e.type === "comboMilestone").map((e) => (e as { count: number }).count)).toEqual([25, 50]);
    const types = events.map((e) => e.type);
    expect(types.filter((t) => t === "feverStart")).toHaveLength(1);
    expect(events[types.indexOf("feverStart") - 1]).toEqual({ type: "combo", count: 15, atMs: noteTimeMs(c, c.notes[14]) });
    expect(types.indexOf("feverEnd")).toBe(types.indexOf("noteMiss") + 1);
    expect(types).not.toContain("fullCombo");
  });

  it("a WRONG note during fever ends it", () => {
    const c = synth(60);
    const events: GameEvent[] = [];
    const judge = new Judge(c, (e) => events.push(e));
    for (let i = 0; i < 52; i++) judge.press(60, noteTimeMs(c, c.notes[i]), i);
    judge.press(61, noteTimeMs(c, c.notes[52]) - 300, 52); // 300 ms from any C4: WRONG
    const types = events.map((e) => e.type);
    expect(types.slice(-3)).toEqual(["extra", "wrongNote", "feverEnd"]);
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

describe("a press first misses what it's past (#586)", () => {
  // Every note hit on time but the 11th, with no frame sweeping in between: a slow page's frames come after the presses.
  const k = 10;
  const run = (opts?: { scored?: boolean }) => {
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e), opts);
    play((i) => (i === k ? null : 0)).events.forEach((e, i) => judge.press(e.pitch, e.timeMs, i));
    return { events, judge };
  };

  it("the MISS comes before the next hit, so max combo is the same however late the sweep", () => {
    const { events, judge } = run();
    const types = events.filter((e) => e.type === "noteHit" || e.type === "noteMiss").map((e) => e.type);
    expect(types.indexOf("noteMiss")).toBe(k);
    expect(judge.finish(1e9).maxCombo).toBe(Math.max(k, chart.notes.length - k - 1));
  });

  it("unscored (wait mode) leaves it unjudged until the end", () => {
    const { events, judge } = run({ scored: false });
    expect(events.some((e) => e.type === "noteMiss")).toBe(false);
    expect(judge.finish(1e9).counts.MISS).toBe(1);
  });
});

describe("scored: false (wait mode): no score moments", () => {
  const types = (opts?: { scored?: boolean }, wrongAfter?: number) => {
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e), opts);
    chart.notes.forEach((n, i) => {
      judge.press(n.pitch, noteTimeMs(chart, n), i);
      if (i === wrongAfter) judge.press(1, noteTimeMs(chart, n) + 10, 1000); // a key far from any note: WRONG
    });
    judge.finish(1e6);
    return events.map((e) => e.type);
  };

  it("all-PERFECT Twinkle sends a milestone, fever and a full combo by default, and none of them unscored", () => {
    for (const t of ["comboMilestone", "feverStart", "fullCombo"] as const) {
      expect(types()).toContain(t);
      expect(types({ scored: false })).not.toContain(t);
    }
    expect(types({ scored: false })).toContain("songEnd");
    expect(types({ scored: false }).filter((t) => t === "noteHit")).toHaveLength(chart.notes.length);
  });

  it("a WRONG during fever ends it by default only", () => {
    expect(types(undefined, 20)).toContain("feverEnd");
    expect(types({ scored: false }, 20)).toContain("wrongNote");
    expect(types({ scored: false }, 20)).not.toContain("feverEnd");
  });
});

describe("Judge.rewind (rewind)", () => {
  it("makes bar 2's notes pressable again and leaves bar 1's judged", () => {
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e), { scored: false });
    const bar = 2400; // 100 bpm, 4 beats
    const inBar = (b: number) => chart.notes.filter((n) => noteTimeMs(chart, n) >= (b - 1) * bar && noteTimeMs(chart, n) < b * bar);
    [...inBar(1), ...inBar(2)].forEach((n, i) => judge.press(n.pitch, noteTimeMs(chart, n), i));
    judge.rewind(bar);
    expect(inBar(1).every((n) => judge.noteState.has(n.id))).toBe(true);
    expect(inBar(2).some((n) => judge.noteState.has(n.id))).toBe(false);
    expect(events.at(-1)).toEqual({ type: "combo", count: 0, atMs: bar });
    const first = inBar(2)[0];
    judge.press(first.pitch, noteTimeMs(chart, first), 99);
    expect(judge.noteState.get(first.id)).toBe("PERFECT");
  });
});
