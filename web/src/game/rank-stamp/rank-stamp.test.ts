import { expect, test } from "vitest";
import { tallySettings } from "../results-tally";
import { impactT, stampImpactMs, stampKeyframes, stampScale, stampSettings, stampStartMs } from ".";

test("the scale starts at 1.6, ends at exactly 1, and overshoots once", () => {
  expect(stampScale(0)).toBeCloseTo(1.6, 10);
  expect(stampScale(1)).toBe(1);
  const s = Array.from({ length: 1001 }, (_, i) => stampScale(i / 1000));
  const crossings = s.slice(1).filter((v, i) => (s[i] - 1) * (v - 1) < 0).length;
  expect(crossings).toBe(1); // goes under 1 once, then only comes back up to it
  const turns = s.slice(1, -1).filter((v, i) => Math.sign(v - s[i]) !== Math.sign(s[i + 2] - v)).length;
  expect(turns).toBe(1); // one low point
  expect(Math.min(...s)).toBeGreaterThan(0.9); // slight, not a bounce
  expect(stampScale(impactT)).toBeCloseTo(1, 10);
});

test("the stamp starts when the tally ends", () => {
  expect(stampSettings.afterTallyMs).toBe(tallySettings.totalMs);
  expect(stampStartMs()).toBe(1200);
  expect(stampImpactMs()).toBe(1200 + Math.round(impactT * 300));
});

test("the keyframes are the curve, from 1.6 and transparent to 1 and solid", () => {
  const css = stampKeyframes("k");
  expect(css).toMatch(/^@keyframes k \{ 0\.00% \{ transform: scale\(1\.6000\); opacity: 0\.000 \}/);
  expect(css).toContain("100.00% { transform: scale(1.0000); opacity: 1.000 }");
});
