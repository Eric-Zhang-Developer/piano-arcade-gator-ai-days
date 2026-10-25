import { describe, expect, it } from "vitest";
import { frameY, notePoint, pitchU, stageLane } from "./lane";

const r = (n: number) => Math.round(n * 1000) / 1000;

describe("stage-view's lane", () => {
  it("brings a note over the crest and down to the bar in the measured 1033 ms", () => {
    expect(notePoint(0, stageLane.approachMs + 1)).toBeNull();
    expect(notePoint(0, -1)).toBeNull();
    expect(r(frameY(1033))).toBe(0.171); // first sighting, measured 0.165-0.174
    expect(r(frameY(497))).toBe(0.043); // the crest: the front fit's vertex (beat lines bottom out at 0.045)
    expect(r(frameY(0))).toBe(0.561); // the bar, measured 0.555 (band 0.542-0.567)
    expect(r(notePoint(0, 0)!.y)).toBe(0.841); // on screen: frame y × 1.5
    expect(notePoint(0, 700)!.alpha).toBeLessThan(notePoint(0, 300)!.alpha); // dim on the back slope
  });

  it("follows the measured note: A-right, u = 0.604, at its frames", () => {
    // 0:21.38 (τ = -0.49 s): x 0.674, y 0.047; 0:21.70 (-0.17 s): 0.742, 0.249; 0:21.82 (-0.05 s): 0.783, 0.462.
    // At the crest the width stalls (0.55-0.59) where the front face's width fit gives 0.63, so x is off by up to 0.02.
    for (const [ms, x, y, dx] of [
      [490, 0.674, 0.047, 0.02],
      [170, 0.742, 0.249, 0.01],
      [50, 0.783, 0.462, 0.01],
    ]) {
      const p = notePoint(0.604, ms)!;
      expect(Math.abs(p.x - x)).toBeLessThan(dx);
      // Times are ±1 frame (17 ms; the capture duplicates and drops frames), so y is within a frame's travel.
      expect(y).toBeGreaterThan(Math.min(frameY(ms + 17), frameY(ms)) - 0.005);
      expect(y).toBeLessThan(frameY(ms - 17) + 0.005);
    }
  });

  it("spreads the chart's range across the field, but not a narrow song to its edges", () => {
    expect(pitchU(48, 48, 84)).toBeCloseTo(-stageLane.uSpan);
    expect(pitchU(84, 48, 84)).toBeCloseTo(stageLane.uSpan);
    expect(pitchU(64, 60, 67)).toBeCloseTo((0.5 / 12) * stageLane.uSpan);
  });
});
