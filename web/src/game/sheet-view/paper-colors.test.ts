import { describe, expect, it } from "vitest";
import { paper } from "../ui-tokens";
import { paperJudgmentColors } from "./paper-colors";

// WCAG 2 relative luminance and contrast ratio.
const lum = (hex: string) =>
  [1, 3, 5]
    .map((k) => parseInt(hex.slice(k, k + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, k) => s + v * [0.2126, 0.7152, 0.0722][k], 0);
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("paperJudgmentColors", () => {
  it.each(Object.entries(paperJudgmentColors))("%s (%s) has at least 3:1 on the paper", (_, color) => {
    expect(contrast(color, paper)).toBeGreaterThanOrEqual(3);
  });

  it("gives each judgment its own color", () => {
    expect(new Set(Object.values(paperJudgmentColors)).size).toBe(4);
  });
});
