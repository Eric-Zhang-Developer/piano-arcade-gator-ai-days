import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Chart } from "../../contracts";
import { settings } from "../core/settings";
import { beatHits, endBeat } from "./index";

const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const mpb = 60000 / chart.bpm;
const count = settings.countInBeats;
const all = beatHits(chart, -Infinity, Infinity);
const at = (note: number) => all.filter((h) => h.note === note).map((h) => h.atMs / mpb);
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

test("Twinkle: side stick on each count-in beat, hi-hat on beats 0–51, kick on each bar's beat 1, nothing from 52", () => {
  expect(endBeat(chart)).toBe(52);
  expect(at(37)).toEqual(range(-count, 0));
  expect(at(42)).toEqual(range(0, 52));
  expect(at(36)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]);
  expect(all.every((h) => h.atMs < 52 * mpb)).toBe(true);
});

test("accent falls on beat 1 of each bar, count-in included", () => {
  expect(all.filter((h) => h.note === 37 && h.accent).map((h) => h.atMs / mpb)).toEqual(range(-count, 0).filter((b) => (b + count) % 4 === 0));
  expect(all.filter((h) => h.note === 42 && h.accent).map((h) => h.atMs / mpb)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]);
});

test("consecutive windows return every hit exactly once", () => {
  const windows: ReturnType<typeof beatHits> = [];
  for (let t = -count * mpb - 7; t < 60 * mpb; t += 300) windows.push(...beatHits(chart, t, t + 300));
  expect(windows).toEqual(all);
});

test("a window returns only the hits inside it", () => {
  expect(beatHits(chart, 0, mpb).map((h) => h.note)).toEqual([36, 42]);
  expect(beatHits(chart, 1, mpb)).toEqual([]);
});
