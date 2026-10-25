import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stampStartMs } from "../rank-stamp";
import { initialsOf, pressKey, type Outcome } from "../records";
import { momentTimes, showsMoment } from "./timing";

describe("record-moment timing", () => {
  it("starts when the rank stamp ends, stampStartMs() + 300, and settles within 2 s", () => {
    const t = momentTimes();
    expect(t.startMs).toBe(stampStartMs() + 300);
    expect(t.cellsAtMs).toBeGreaterThan(t.startMs);
    expect(t.endMs - t.startMs).toBeLessThanOrEqual(2000);
  });
});

describe("when the moment shows", () => {
  const recorded = (newRecord: boolean, inTop: boolean): Outcome => ({ kind: "recorded", chartId: "twinkle", date: "d", newRecord, inTop, top: [] });

  it("for a recorded take with newRecord, not for a top-5 place alone, a practice take or blocked storage", () => {
    expect(showsMoment(recorded(true, true))).toBe(true);
    expect(showsMoment(recorded(false, true))).toBe(false);
    expect(showsMoment({ kind: "practice" })).toBe(false);
    expect(showsMoment({ kind: "blocked" })).toBe(false);
    expect(showsMoment(null)).toBe(false);
  });
});

describe("the entry during the reveal", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps keys typed before the cells appear: the letters belong to the take, not to the cells", () => {
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    const date = "2026-10-24T18:00:00.000Z";
    for (const k of ["e", "r"]) pressKey("twinkle", date, k); // at 1.5 s, before the cells rise at 1.8 s
    pressKey("twinkle", date, "i");
    expect(initialsOf("twinkle", date).letters).toEqual(["E", "R", "I"]);
  });
});

describe("record-moment's look (Duo kit, #1138)", () => {
  const css = readFileSync(new URL("./record-moment.module.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  it("sets nothing in italic and rounds no corner", () => {
    expect(css).not.toMatch(/italic/);
    expect(css.match(/border-radius:\s*([^;]+);/g) ?? []).toEqual(["border-radius: 0;"]);
  });
  it("sizes the hint 16 px at 720 tall and 24 px at 1080, the video rule", () => {
    const [, min, vh, max] = css.match(/\.hint\s*{[^}]*font:\s*clamp\((\d+)px,\s*([\d.]+)vh,\s*(\d+)px\)/)!;
    const at = (h: number) => Math.min(+max, Math.max(+min, (+vh * h) / 100));
    expect(Math.round(at(720))).toBe(16);
    expect(Math.round(at(1080))).toBe(24);
  });
});
