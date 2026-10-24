import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, ChartNote, Take, TakeEvent } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { chordSync } from ".";
import { describeChords, direction, findChords, isRolled, scoreChords } from "./chords";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const note = (id: string, pitch: number, beat: number, hand: "L" | "R"): ChartNote => ({ id, pitch, beat, duration: 1, hand });
// Bar 1 beat 1: a left-hand chord (48, 52, 55) and a right-hand chord (64, 67); bar 2 beat 1: a lone note.
const chart: Chart = {
  id: "t", title: "t", composer: "t", source: "t", bpm: 60, beatsPerBar: 4,
  notes: [note("a", 48, 0, "L"), note("b", 52, 0, "L"), note("c", 55, 0, "L"), note("d", 64, 0, "R"), note("e", 67, 0, "R"), note("f", 60, 4, "R")],
};

// Each note pressed at its time plus `offsets[id]` (ms); a missing id isn't played.
function play(c: Chart, offsets: Record<string, number>): Take {
  const events: TakeEvent[] = c.notes
    .filter((n) => n.id in offsets)
    .map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: noteTimeMs(c, n) + offsets[n.id], offTimeMs: null }));
  return { chartId: c.id, startedAt: new Date(0).toISOString(), latencyOffsetMs: 0, inputDevice: "test", events };
}
const score = (offsets: Record<string, number>) => {
  const t = play(chart, offsets);
  return scoreChords(chart, t, judgeTake(chart, t));
};

describe("chord sync", () => {
  it("a beat where both hands hold a chord gives two chords; a lone note gives none", () => {
    expect(findChords(chart).map((c) => [c.hand, c.beat, c.notes.length])).toEqual([["L", 0, 3], ["R", 0, 2]]);
    expect(findChords(twinkle)).toEqual([]);
  });

  it("40 ms apart is rolled, 20 ms isn't, and exactly 30 ms isn't", () => {
    for (const [spread, rolled] of [[40, true], [20, false], [30, false]] as const) {
      const [left] = score({ a: 0, b: spread / 2, c: spread, d: 0, e: 0, f: 0 });
      expect(left.spreadMs).toBe(spread);
      expect(isRolled(left)).toBe(rolled);
    }
  });

  it("one hit and one MISS is incomplete, not rolled", () => {
    const [, right] = score({ a: 0, b: 0, c: 0, d: 0, f: 0 }); // e never pressed
    expect(right).toEqual({ hand: "R", beat: 0, spreadMs: null, direction: null });
    expect(isRolled(right)).toBe(false);
  });

  it("names the direction: ascending, descending, mixed", () => {
    expect(direction([{ pitch: 48, timeMs: 0 }, { pitch: 52, timeMs: 20 }, { pitch: 55, timeMs: 45 }])).toBe("low to high");
    expect(direction([{ pitch: 48, timeMs: 45 }, { pitch: 52, timeMs: 20 }, { pitch: 55, timeMs: 0 }])).toBe("high to low");
    expect(direction([{ pitch: 48, timeMs: 20 }, { pitch: 52, timeMs: 0 }, { pitch: 55, timeMs: 45 }])).toBe("mixed");
  });

  it("the panel counts every chord and lists each rolled one", () => {
    const chords = score({ a: 0, b: 20, c: 48, d: 0, e: 5, f: 0 });
    expect(describeChords(chart, chords)).toEqual({
      summary: "1 of 2 chords rolled",
      rows: ["Bar 1, beat 1, left hand: 48 ms, low to high"],
    });
  });

  it("Twinkle (no chords) renders nothing", () => {
    const t = play(twinkle, Object.fromEntries(twinkle.notes.map((n) => [n.id, 0])));
    const panel = chordSync().resultsPanel!({ chart: twinkle, take: t, results: judgeTake(twinkle, t), params: new URLSearchParams(), retry: () => {} });
    expect(panel).toBeNull();
  });
});
