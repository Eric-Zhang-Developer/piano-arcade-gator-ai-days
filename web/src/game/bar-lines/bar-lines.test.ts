import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { loopChart } from "../bar-loop";
import type { Layout } from "../core/highway";
import { settings } from "../core/settings";
import { handColorSettings } from "../hand-colors";
import { pillSettings } from "../note-pills";
import { ink } from "../ui-tokens";
import { barLines, barLineSettings, drawBarLines } from ".";

// Notes at the given beats, each one beat long.
const chart = (bpm: number, beatsPerBar: number, beats: number[]): Chart =>
  ({ id: "t", title: "t", bpm, beatsPerBar, notes: beats.map((beat, i) => ({ id: `n${i}`, pitch: 60, beat, duration: 1, hand: "R" })) }) as Chart;
const none = new URLSearchParams();

describe("barLines", () => {
  it("bar 1 at 0 ms and bar n at (n − 1) × beatsPerBar beats, at two bpms", () => {
    const c = chart(120, 4, [0, 15]); // ends at beat 16: four bars
    expect(barLines(c, none)).toEqual([0, 2000, 4000, 6000].map((atMs, i) => ({ atMs, label: i + 1 })));
    expect(barLines({ ...c, bpm: 60 }, none).map((b) => b.atMs)).toEqual([0, 4000, 8000, 12000]);
  });

  it("at beatsPerBar 1.5, each start is computed, one per bar up to the last and none past it", () => {
    const c = chart(60, 1.5, [0, 44 * 1.5 + 0.25]); // ends inside bar 45
    const lines = barLines(c, none);
    expect(lines).toHaveLength(45);
    expect(lines[44]).toEqual({ atMs: 44 * 1.5 * 1000, label: 45 });
    expect(lines[7].atMs).toBe(7 * 1500);
  });

  it("in a bar-loop take, the song's numbers: 5, 6, an empty bar, 5, 6; tempo keeps them", () => {
    const song = chart(100, 4, Array.from({ length: 32 }, (_, i) => i)); // 8 bars
    for (const q of ["from=5&to=6&passes=2", "from=5&to=6&passes=2&tempo=50"]) {
      const params = new URLSearchParams(q);
      const played = loopChart(song, params)!.chart;
      expect(barLines(played, params).map((b) => b.label)).toEqual([5, 6, null, 5, 6]);
    }
  });
});

// Rec. 709 weights on sRGB values, as fever-stage measures.
const luma = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

it("calm: the line and the number are each no brighter than the dimmest note", () => {
  const colors = [...Object.values(handColorSettings.colors), settings.noteColor];
  const dimmest = pillSettings.farBrightness * Math.min(...colors.map(luma));
  expect(barLineSettings.lineAlpha * luma("#ffffff")).toBeLessThanOrEqual(dimmest);
  expect(barLineSettings.labelAlpha * luma(ink)).toBeLessThanOrEqual(dimmest);
});

describe("drawBarLines", () => {
  // A 1000 × 720 canvas with its line at 600: 2000 ms of lookahead over 600 px.
  const L = { width: 1000, height: 720, judgmentLineY: 600, project: (x: number) => x } as unknown as Layout;
  const record = () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => calls.push(`${k} ${a.join(",")}`)),
      set: (t, k: string, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  };

  it("strokes only the lines on the highway, and labels each numbered one", () => {
    const { ctx, calls } = record();
    const lines = [
      { atMs: -100, label: 1 }, // past the line: over the keys
      { atMs: 500, label: 2 },
      { atMs: 1500, label: null },
      { atMs: 2500, label: 4 }, // past the top
    ];
    drawBarLines(ctx, L, lines, 0);
    expect(calls.filter((c) => c === "stroke ")).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith("moveTo"))).toEqual(["moveTo 0,450.5", "moveTo 0,150.5"]);
    expect(calls.filter((c) => c.startsWith("fillText"))).toEqual(["fillText 2,6,448.5"]);
  });
});
