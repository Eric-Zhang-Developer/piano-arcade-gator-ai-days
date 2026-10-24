import { describe, expect, it } from "vitest";
import { keyPreviewSettings, previewAlpha, previewKeys, type PreviewNote } from ".";

const { leadMs, peakAlpha } = keyPreviewSettings;
const note = (id: string, pitch: number, timeMs: number, hand: "R" | "L" = "R"): PreviewNote => ({ id, pitch, hand, timeMs });

describe("previewAlpha", () => {
  it("is 0 at 500 ms and beyond, peakAlpha at the line, rising in between, and 0 once the time has passed", () => {
    expect(previewAlpha(leadMs)).toBe(0);
    expect(previewAlpha(leadMs + 200)).toBe(0);
    expect(previewAlpha(0)).toBe(peakAlpha);
    expect(previewAlpha(250)).toBeCloseTo(peakAlpha / 2);
    expect(previewAlpha(100)).toBeGreaterThan(previewAlpha(300));
    expect(previewAlpha(-1)).toBe(0);
  });
});

describe("previewKeys", () => {
  it("lights a note's key in the window, in its hand, and a hit note drops out at once", () => {
    const notes = [note("a", 60, 1000, "L")];
    expect(previewKeys(notes, 400, new Set())).toEqual([]);
    expect(previewKeys(notes, 800, new Set())).toEqual([{ pitch: 60, hand: "L", alpha: previewAlpha(200) }]);
    expect(previewKeys(notes, 800, new Set(["a"]))).toEqual([]);
    expect(previewKeys(notes, 1001, new Set())).toEqual([]);
  });

  it("a chord lights all its pitches", () => {
    const chord = [note("c", 60, 1000), note("e", 64, 1000), note("g", 67, 1000)];
    expect(previewKeys(chord, 900, new Set()).map((k) => k.pitch).sort()).toEqual([60, 64, 67]);
  });

  it("a repeated pitch takes the nearer note", () => {
    const notes = [note("later", 60, 1300), note("sooner", 60, 1100)];
    expect(previewKeys(notes, 900, new Set())).toEqual([{ pitch: 60, hand: "R", alpha: previewAlpha(200) }]);
    expect(previewKeys(notes, 900, new Set(["sooner"]))).toEqual([{ pitch: 60, hand: "R", alpha: previewAlpha(400) }]);
  });
});
