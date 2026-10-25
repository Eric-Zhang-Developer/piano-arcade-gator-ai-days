import { describe, expect, it } from "vitest";
import type { Chart, ChartNote } from "../../contracts";
import { laptopReach, melody, newRun, phrase, phraseMessages, step, type Run } from ".";

// Synthetic charts only: no notes typed from a song.
const n = (id: string, pitch: number, beat: number, hand: "R" | "L" = "R", duration = 1): ChartNote => ({ id, pitch, beat, duration, hand });
const chart = (notes: ChartNote[], bpm = 120) => ({ id: "t", title: "t", composer: "t", bpm, notes }) as unknown as Chart;

const tune = melody(chart([n("a", 60, 0), n("b", 62, 1), n("c", 64, 2), n("d", 65, 3)]));
const play = (run: Run, pitches: number[]) => pitches.reduce((r, p) => step(r, { type: "on", pitch: p }, tune), step(run, { type: "turn" }, tune));

describe("simon", () => {
  it("melody: a right-hand chord gives its top note, the left hand is skipped, beat order", () => {
    const m = melody(chart([n("x", 67, 2), n("l", 40, 0, "L"), n("c1", 60, 0), n("c2", 64, 0), n("y", 62, 1)]));
    expect(m.map((x) => x.pitch)).toEqual([64, 62, 67]);
  });

  it("round k's phrase is the first k + 1 notes", () => {
    expect(phrase(tune, 1).map((x) => x.id)).toEqual(["a", "b"]);
    expect(phrase(tune, 3).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("phraseMessages: on and off on channel 1, spaced as the chart's beats at its bpm, from startMs", () => {
    const c = chart([n("a", 60, 4, "R", 0.5), n("b", 62, 5)], 120); // 500 ms a beat
    expect(phraseMessages(c, melody(c), 1000)).toEqual([
      { bytes: [0x90, 60, 80], atMs: 1000 },
      { bytes: [0x80, 60, 0], atMs: 1250 },
      { bytes: [0x90, 62, 80], atMs: 1500 },
      { bytes: [0x80, 62, 0], atMs: 2000 },
    ]);
  });

  it("phraseMessages: a repeated note's release comes before its next press", () => {
    const c = chart([n("a", 60, 0), n("b", 60, 1)]);
    expect(phraseMessages(c, melody(c), 0).map((m) => m.bytes[0])).toEqual([0x90, 0x80, 0x90, 0x80]);
  });

  it("step: the right order clears the round", () => {
    expect(play(newRun(), [60, 62])).toEqual({ round: 2, pos: 0, phase: "listen", wrong: null });
  });

  it("step: a wrong pitch ends the run at that round; an octave up is wrong", () => {
    const r2 = play(newRun(), [60, 62]);
    expect(play(r2, [60, 74])).toMatchObject({ round: 2, phase: "over", wrong: 74 });
    expect(play(newRun(), [72])).toMatchObject({ round: 1, phase: "over", wrong: 72 });
  });

  it("step: presses while listening and releases change nothing", () => {
    const run = newRun();
    expect(step(run, { type: "on", pitch: 99 }, tune)).toBe(run);
    const turn = step(run, { type: "turn" }, tune);
    expect(step(turn, { type: "off" }, tune)).toBe(turn);
  });

  it("step: there's no time limit (a 60 s gap is fine, since step has no clock)", () => {
    const first = play(newRun(), [60]);
    expect(step(first, { type: "on", pitch: 62 }, tune)).toMatchObject({ round: 2, phase: "listen" });
  });

  it("step: repeating the whole melody is a win", () => {
    let run = newRun();
    for (let k = 1; k <= 2; k++) run = play(run, phrase(tune, k).map((x) => x.pitch));
    expect(play(run, [60, 62, 64, 65])).toMatchObject({ round: 3, phase: "won" });
  });

  it("laptopReach: null when the row covers the melody, else the last round it can play", () => {
    expect(laptopReach(tune)).toBeNull();
    const wide = melody(chart([n("a", 60, 0), n("b", 62, 1), n("c", 64, 2), n("d", 84, 3)]));
    expect(laptopReach(wide)).toBe(2);
  });
});
