import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, Take } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { reviewUrl } from ".";
import { REVIEW_KEY, loadReview, reviewLine, reviewOf, saveReview } from "./review";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

// Every other note played on time, the rest left out: PERFECTs and MISSes.
const take: Take = {
  chartId: twinkle.id,
  startedAt: new Date(2026, 9, 24, 14, 2, 30).toISOString(),
  latencyOffsetMs: 0,
  inputDevice: "test",
  events: twinkle.notes
    .filter((_, i) => i % 2 === 0)
    .map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: noteTimeMs(twinkle, n), offTimeMs: null })),
};
const results = judgeTake(twinkle, take);

function stubStorage(throws = false) {
  const m = new Map<string, string>();
  const no = () => {
    throw new Error("blocked");
  };
  vi.stubGlobal("localStorage", {
    getItem: throws ? no : (k: string) => m.get(k) ?? null,
    setItem: throws ? no : (k: string, v: string) => void m.set(k, v),
  });
  return m;
}
afterEach(() => vi.unstubAllGlobals());

describe("sheet-review", () => {
  it("keeps every note's judgment of a Twinkle take", () => {
    const r = reviewOf(twinkle, take, results);
    expect(Object.keys(r.judgments)).toHaveLength(twinkle.notes.length);
    for (const j of results.judgments) expect(r.judgments[j.noteId]).toBe(j.judgment);
    expect(new Set(Object.values(r.judgments))).toEqual(new Set(["PERFECT", "MISS"]));
    expect(r).toMatchObject({ chart: twinkle, startedAt: take.startedAt, accuracy: results.accuracy });
  });

  it("loads what it saved", () => {
    stubStorage();
    const r = reviewOf(twinkle, take, results);
    saveReview(r);
    expect(loadReview()).toEqual(r);
  });

  it("loads null for nothing stored, corrupt JSON, a bad shape and a throwing localStorage", () => {
    const m = stubStorage();
    expect(loadReview()).toBeNull();
    m.set(REVIEW_KEY, "{not json");
    expect(loadReview()).toBeNull();
    const ok = reviewOf(twinkle, take, results);
    for (const bad of [
      { ...ok, chart: { ...twinkle, notes: "x" } },
      { ...ok, judgments: { n1: "SUPER" } },
      { ...ok, startedAt: "yesterday" },
      { ...ok, accuracy: 92.4 },
    ]) {
      m.set(REVIEW_KEY, JSON.stringify(bad));
      expect(loadReview()).toBeNull();
    }
    stubStorage(true);
    expect(loadReview()).toBeNull();
    expect(() => saveReview(ok)).not.toThrow();
  });

  it("formats the header line in local time, accuracy to one decimal", () => {
    expect(reviewLine({ startedAt: take.startedAt, accuracy: 0.924 })).toBe("Review · take at 14:02 · 92.4%");
    expect(reviewLine({ startedAt: new Date(2026, 0, 1, 9, 5).toISOString(), accuracy: 1 })).toBe("Review · take at 09:05 · 100.0%");
  });

  it("opens the sheet on the take's song, in review", () => {
    expect(reviewUrl(new URLSearchParams("song=ode-to-joy&input=test"))).toBe("/sheet?song=ode-to-joy&review=1");
  });
});
