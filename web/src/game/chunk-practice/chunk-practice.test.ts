import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { loopChart } from "../bar-loop";
import { chunksOf, nextAfter, practiceStep, stepUrl, wholeSongUrl } from "./chunks";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));

// A 4/4 chart with one note at the start of each listed bar (1-based), in the given hand.
const bars = (list: [number, "L" | "R"][]): Chart =>
  ({
    id: "t",
    title: "t",
    bpm: 100,
    beatsPerBar: 4,
    notes: list.map(([bar, hand], i) => ({ id: `n${i}`, pitch: 60, beat: (bar - 1) * 4, duration: 4, hand })),
  }) as Chart;

describe("chunksOf", () => {
  it("cuts Twinkle's 12 bars into 1–4, 5–8, 9–12", () => {
    expect(chunksOf(song("twinkle"), null)).toEqual([
      { from: 1, to: 4 },
      { from: 5, to: 8 },
      { from: 9, to: 12 },
    ]);
  });

  it("gives Für Elise's 45 bars 12 chunks, the last bar alone", () => {
    const list = chunksOf(song("fur-elise"), null);
    expect(list).toHaveLength(12);
    expect(list.at(-1)).toEqual({ from: 45, to: 45 });
  });

  it("skips a chunk with no notes, and a 3-bar chart is one chunk", () => {
    expect(chunksOf(bars([[1, "R"], [10, "R"]]), null)).toEqual([
      { from: 1, to: 4 },
      { from: 9, to: 10 },
    ]);
    expect(chunksOf(bars([[1, "R"], [3, "R"]]), null)).toEqual([{ from: 1, to: 3 }]);
  });

  it("with hands=L, skips a chunk only the right hand plays", () => {
    const c = bars([[1, "L"], [2, "R"], [5, "R"], [9, "L"]]);
    expect(chunksOf(c, "L")).toEqual([
      { from: 1, to: 4 },
      { from: 9, to: 9 },
    ]);
    expect(chunksOf(c, null)).toHaveLength(3);
  });

  it("every Twinkle and Für Elise chunk is a range bar-loop accepts", () => {
    for (const id of ["twinkle", "fur-elise"]) {
      const c = song(id);
      for (const ch of chunksOf(c, null))
        expect(() => loopChart(c, new URLSearchParams(stepUrl(new URLSearchParams(), ch, "play").split("?")[1]))).not.toThrow();
    }
  });
});

describe("step URLs", () => {
  const params = new URLSearchParams("song=twinkle&hands=L");

  it("learn and play keep every other param, and differ only by mode", () => {
    expect(stepUrl(params, { from: 5, to: 8 }, "learn")).toBe("/play?song=twinkle&hands=L&from=5&to=8&tempo=70&passes=1&mode=wait&practice=1");
    expect(stepUrl(params, { from: 5, to: 8 }, "play")).toBe("/play?song=twinkle&hands=L&from=5&to=8&tempo=70&passes=1&practice=1");
  });

  it("the whole song keeps only song and hands", () => {
    expect(wholeSongUrl(new URLSearchParams("song=twinkle&from=9&to=12&tempo=70&passes=1&practice=1&hands=R&bot=perfect"))).toBe(
      "/play?song=twinkle&hands=R",
    );
  });

  it("practiceStep reads the chunk and step, and ignores bars that aren't a chunk", () => {
    const list = chunksOf(song("twinkle"), null);
    const q = (s: string) => new URLSearchParams(s);
    expect(practiceStep(q("from=5&to=8&mode=wait&practice=1"), list)).toEqual({ index: 1, step: "learn" });
    expect(practiceStep(q("from=5&to=8&practice=1"), list)).toEqual({ index: 1, step: "play" });
    expect(practiceStep(q("from=5&to=8"), list)).toBeNull();
    expect(practiceStep(q("from=2&to=8&practice=1"), list)).toBeNull();
  });
});

describe("nextAfter", () => {
  const list = chunksOf(song("twinkle"), null);
  it("moves on at 85%, not at 84.9%", () => {
    expect(nextAfter(list, 0, 0.85)).toEqual({ next: { from: 5, to: 8 } });
    expect(nextAfter(list, 0, 0.849)).toBeNull();
  });
  it("after the last chunk, the whole song", () => {
    expect(nextAfter(list, 2, 1)).toEqual({ whole: true });
  });
});
