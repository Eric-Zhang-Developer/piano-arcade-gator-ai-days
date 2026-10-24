import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { isBlack, makeLayout } from "./highway";

const chart = (pitches: number[]): Chart => ({
  id: "t",
  title: "t",
  composer: "t",
  source: "test",
  bpm: 100,
  beatsPerBar: 4,
  notes: pitches.map((pitch, i) => ({ id: String(i), pitch, beat: i, duration: 1, hand: "R" })),
});

describe("makeLayout", () => {
  it("pads C4–A4 to one extra white key each side: B3..B4", () => {
    const L = makeLayout(chart([60, 69]), 800, 600, 0);
    expect([L.lowPitch, L.highPitch]).toEqual([59, 71]);
  });

  it("pads black-key ends to whole white keys first: C#4–A#4 gives B3..C5", () => {
    const L = makeLayout(chart([61, 70]), 800, 600, 0);
    expect([L.lowPitch, L.highPitch]).toEqual([59, 72]);
    expect(isBlack(L.lowPitch) || isBlack(L.highPitch)).toBe(false);
  });

  it("lays keys left to right; black keys are narrower and straddle their neighbours", () => {
    const L = makeLayout(chart([60, 72]), 900, 600, 0);
    let prev = -Infinity;
    for (let p = L.lowPitch; p <= L.highPitch; p++) {
      const k = L.keyX(p);
      expect(k.x).toBeGreaterThan(prev);
      prev = k.x;
    }
    const white = L.keyX(60), black = L.keyX(61), next = L.keyX(62);
    expect(black.width).toBeLessThan(white.width);
    expect(black.x + black.width / 2).toBeCloseTo(next.x);
    expect(L.keyX(L.highPitch).x + L.keyX(L.highPitch).width).toBeCloseTo(900);
  });

  it("perspective keeps the judgment line aligned and narrows the top by (1 - p)", () => {
    const L = makeLayout(chart([60, 72]), 1000, 600, 0.3);
    const cx = 500;
    for (const x of [0, 137, 500, 1000]) {
      expect(L.project(x, L.judgmentLineY)).toBeCloseTo(x);
      expect(L.project(x, 0) - cx).toBeCloseTo((x - cx) * 0.7);
    }
    expect(makeLayout(chart([60]), 1000, 600, 0.9).perspective).toBe(0.3);
  });
});
