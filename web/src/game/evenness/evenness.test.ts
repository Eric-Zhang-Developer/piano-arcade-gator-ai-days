import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, ChartNote, Hand, Results, Take } from "../../contracts";
import { describeEvenness, findRuns, scoreEvenness } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

const note = (id: string, beat: number, hand: Hand = "R", pitch = 60): ChartNote => ({ id, pitch, beat, duration: 1, hand });
const chartOf = (notes: ChartNote[]): Chart => ({ ...twinkle, bpm: 200, notes }); // 300 ms beat

// A take that presses each note at its chart time plus offsets[i]; missed ids get no press.
function take(chart: Chart, offsets: (i: number) => number, missed: string[] = []): { take: Take; results: Results } {
  const events: Take["events"] = [];
  const judgments = chart.notes.map((n, i) => {
    if (missed.includes(n.id)) return { noteId: n.id, judgment: "MISS" as const, offsetMs: null, eventIndex: null };
    events.push({ pitch: n.pitch, velocity: 80, timeMs: n.beat * (60000 / chart.bpm) + offsets(i), offTimeMs: null });
    return { noteId: n.id, judgment: "PERFECT" as const, offsetMs: 0, eventIndex: events.length - 1 };
  });
  const results = { chartId: chart.id, judgments, extras: [], counts: { PERFECT: 0, GREAT: 0, MISS: 0, extra: 0 }, accuracy: 1, maxCombo: 0, rank: "S" } as Results;
  return { take: { chartId: chart.id, startedAt: "", latencyOffsetMs: 0, inputDevice: "test", events }, results };
}
const score = (chart: Chart, offsets: (i: number) => number, missed: string[] = []) => {
  const t = take(chart, offsets, missed);
  return scoreEvenness(chart, t.take, t.results);
};

describe("runs", () => {
  it("Twinkle: the opening C C G G A A G is one run, and the half note ends it", () => {
    const runs = findRuns(twinkle);
    expect(runs[0].notes.map((n) => n.beat)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(runs[1].notes[0].beat).toBe(8);
    expect(runs.every((r) => r.hand === "R" && r.gapBeats === 1)).toBe(true);
  });

  it("chord notes never join a run", () => {
    const notes = [0, 1, 2, 3, 4, 5].map((b) => note(`n${b}`, b));
    notes.push(note("chord", 3, "R", 64));
    const runs = findRuns(chartOf(notes));
    expect(runs.flatMap((r) => r.notes.map((n) => n.id))).not.toContain("chord");
    expect(runs.flatMap((r) => r.notes.map((n) => n.beat))).not.toContain(3);
  });
});

describe("scores", () => {
  const run8 = chartOf([0, 1, 2, 3, 4, 5, 6, 7].map((b) => note(`n${b}`, b)));

  it("a run played exactly on time scores 100", () => {
    expect(score(run8, () => 0).hands).toEqual([{ hand: "R", score: 100 }]);
  });

  it("gaps alternating +20 and -20 ms on a 300 ms beat score 93", () => {
    // presses at 0, +20, 0, +20, …: gaps 320, 280, 320, …
    const e = score(run8, (i) => (i % 2 ? 20 : 0));
    expect(e.hands).toEqual([{ hand: "R", score: 93 }]);
    expect(describeEvenness(e, run8).worst).toBe("Bars 1–2, right hand: gaps varied ±20 ms on a 300 ms beat");
  });

  it("a MISS splits a run, and the hands are scored apart", () => {
    const right = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => note(`r${b}`, b));
    const left = [0, 2, 4, 6].map((b) => note(`l${b}`, b, "L", 48));
    const chart = chartOf([...right, ...left]);
    // r4 missed: r0–r3 (3 gaps) and r5–r9 (4 gaps) are scored apart, so r3→r5 is never a gap. Left hand alternates 0 and +30 ms.
    const e = score(chart, (i) => (i >= 10 && i % 2 ? 30 : 0), ["r4"]);
    expect(e.hands).toEqual([
      { hand: "R", score: 100 },
      { hand: "L", score: 95 }, // ±30 ms on its 600 ms gap
    ]);
    // A piece with fewer than 3 played gaps is dropped: missing r3 leaves r0–r2 (2 gaps).
    expect(score(chart, () => 0, ["r3"]).hands[0]).toEqual({ hand: "R", score: 100 });
  });

  it("a chart with no runs gives the message", () => {
    const chart = chartOf([note("a", 0), note("b", 1), note("c", 3)]);
    expect(describeEvenness(score(chart, () => 0), chart).empty).toBe("No runs to score in this song");
  });
});
