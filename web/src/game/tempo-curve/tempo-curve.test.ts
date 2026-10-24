import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Take } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { seededRandom } from "../sim/fake";
import { describeRubato, fitCurve, rubato } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const end = Math.max(...twinkle.notes.map((n) => noteTimeMs(twinkle, n)));

// A take pressing every note at played(chart time), judged strictly by the real judge.
function play(played: (t: number) => number, chart = twinkle) {
  const events: Take["events"] = chart.notes
    .map((n) => noteTimeMs(chart, n))
    .map((t, i) => ({ pitch: chart.notes[i].pitch, velocity: 80, timeMs: played(t), offTimeMs: null }))
    .sort((a, b) => a.timeMs - b.timeMs);
  const take: Take = { chartId: chart.id, startedAt: "", latencyOffsetMs: 0, inputDevice: "test", events };
  const results = judgeTake(chart, take);
  return { take, results, rubato: rubato(chart, take, results) };
}

// Tempo falling linearly from 100% to 80% over the song: played time is the integral of 1 / tempo.
const slowing = (t: number) => {
  const k = 0.2 / end;
  return Math.log(1 / (1 - k * t)) / k;
};

describe("rubato judging", () => {
  it("a steady slowdown from 100% to 80% is all PERFECT in rubato, and drifts to GREAT and MISS in strict", () => {
    const { results, rubato: r } = play(slowing);
    expect(r.counts.PERFECT).toBe(twinkle.notes.length);
    expect(results.counts.GREAT).toBeGreaterThan(0);
    expect(results.counts.MISS).toBeGreaterThan(0);
    expect(r.accuracy).toBe(1);
    expect(r.recovered).toBe(results.counts.MISS);
    expect(r.bpmRange![0]).toBeLessThan(r.bpmRange![1]);
  });

  it("a steady speed-up from 100% to 125% is all PERFECT in rubato too", () => {
    // Speeding up, the strict judge pairs a note with the next same-pitch note's earlier press. Those strict hits sit
    // far off the curve, and taking them would leave the next note without its press.
    const k = 0.25 / end;
    const { results, rubato: r } = play((t) => Math.log(1 + k * t) / k);
    expect(results.counts.MISS + results.counts.GREAT).toBeGreaterThan(0);
    expect(r.counts.PERFECT).toBe(twinkle.notes.length);
  });

  it("a steady +10 ms take is all PERFECT both ways", () => {
    const { results, rubato: r } = play((t) => t + 10);
    expect(results.counts.PERFECT).toBe(twinkle.notes.length);
    expect(r.counts.PERFECT).toBe(twinkle.notes.length);
  });

  it("random ±80 ms jitter on every note is not all PERFECT: the window can't follow note-to-note jitter", () => {
    const r = seededRandom(135);
    const { rubato: rb } = play((t) => t + (r() * 2 - 1) * 80);
    expect(rb.counts.PERFECT).toBeLessThan(twinkle.notes.length);
  });

  it("the local tempo is clamped to 50% and 150%", () => {
    const points = (rate: number) => Array.from({ length: 20 }, (_, i) => ({ t: i * 600, p: (i * 600) / rate }));
    expect(fitCurve(points(0.3), 4800).tempo(6000)).toBeCloseTo(0.5);
    expect(fitCurve(points(2), 4800).tempo(6000)).toBeCloseTo(1.5);
    expect(fitCurve(points(0.9), 4800).tempo(6000)).toBeCloseTo(0.9);
  });

  it("one-to-one: a press matches at most one note, and a note at most one press", () => {
    // Twinkle opens C C: drop the second C's press, so only one press is near two notes of its pitch.
    const { take } = play(slowing);
    const firstC = take.events.findIndex((e) => e.pitch === 60);
    take.events.splice(firstC + 1, 1);
    const results = judgeTake(twinkle, take);
    const r = rubato(twinkle, take, results);
    const hit = r.judgments.filter((j) => j.judgment !== "MISS");
    expect(hit.length).toBe(twinkle.notes.length - 1);
    expect(new Set(hit.map((j) => j.noteId)).size).toBe(hit.length);
  });

  it("fewer than 8 hits: not enough to fit a curve", () => {
    const { take } = play((t) => t);
    take.events = take.events.slice(0, 7);
    const r = rubato(twinkle, take, judgeTake(twinkle, take));
    expect(r.enough).toBe(false);
    expect(describeRubato(r)[0]).toMatch(/Not enough hits/);
  });

  it("the panel line reads rubato, then strict", () => {
    expect(describeRubato(play(slowing).rubato)[0]).toMatch(/^Rubato score 100% · strict \d+%$/);
  });
});
