import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Chart, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";

const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/minuet-g/chart.json", import.meta.url), "utf8"));

// Counted from the source's right hand, bars 1-16 (Mutopia 75): 5+3+5+3+5+5+5+1 and 5+3+5+3+5+5+5+1 = 64 notes,
// grace note dropped, then the repeat written out.
const SOURCE_NOTES = 64 * 2;

test("the chart is valid, with the spec's fields", () => {
  expect(validateChart(chart)).toEqual([]);
  expect(chart).toMatchObject({
    id: "minuet-g",
    title: "Minuet in G major",
    composer: "Christian Petzold (attributed; formerly J. S. Bach)",
    catalog: "BWV Anh. 114",
    beatsPerBar: 3,
    bpm: 100,
  });
  expect(chart.notes.every((n) => n.hand === "R")).toBe(true);
});

test("every note sits inside its bar, and every bar adds up to 3 beats", () => {
  const bars = new Map<number, number>();
  for (const n of chart.notes) {
    const bar = Math.floor(n.beat / 3);
    expect(n.beat + n.duration, `${n.id} crosses a barline`).toBeLessThanOrEqual((bar + 1) * 3);
    bars.set(bar, (bars.get(bar) ?? 0) + n.duration);
  }
  expect([...bars.keys()]).toEqual([...Array(32).keys()]); // 16 bars, twice
  expect([...bars.values()].every((beats) => beats === 3)).toBe(true);
});

test("the note count matches the source", () => {
  expect(chart.notes).toHaveLength(SOURCE_NOTES);
  // The repeat is the same 64 notes, 48 beats later.
  const first = chart.notes.slice(0, 64).map((n) => [n.pitch, n.beat + 48, n.duration]);
  expect(chart.notes.slice(64).map((n) => [n.pitch, n.beat, n.duration])).toEqual(first);
});

test("a Perfect player gets every note PERFECT, 100%, rank S", () => {
  const take: Take = {
    chartId: chart.id,
    startedAt: new Date(0).toISOString(),
    latencyOffsetMs: 0,
    inputDevice: "test",
    events: chart.notes.map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: noteTimeMs(chart, n), offTimeMs: null })),
  };
  const r = judgeTake(chart, take);
  expect(r.counts).toMatchObject({ PERFECT: SOURCE_NOTES, GREAT: 0, MISS: 0, extra: 0 });
  expect(r.accuracy).toBe(1);
  expect(r.rank).toBe("S");
  expect(r.maxCombo).toBe(SOURCE_NOTES);
});
