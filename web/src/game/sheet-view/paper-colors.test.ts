import { readFileSync } from "node:fs";
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

// verify-sheet.mjs counts PERFECT noteheads by fill. It can't import this TypeScript, so it keeps its own copy: #730
// changed the color here and the check went on looking for the old gold (#1021).
it("verify-sheet.mjs looks for the paper's PERFECT", () => {
  const src = readFileSync(new URL("./verify-sheet.mjs", import.meta.url), "utf8");
  expect(src.match(/const PERFECT_FILL = "(#[0-9a-f]{6})"/i)?.[1]).toBe(paperJudgmentColors.PERFECT);
});
