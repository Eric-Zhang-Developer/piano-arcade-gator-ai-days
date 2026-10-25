import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { difficulty } from "./difficulty";
import { mappedLevel, reviewedLevels } from "./reviewed";
import { LAB_ONLY } from "../song-select/load";
import { easyChart } from "../easy-charts/chart";

const songsDir = new URL("../../../public/songs/", import.meta.url);
const charts = new Map<string, Chart>(
  readdirSync(songsDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.split(sep).pop() === "chart.json" && !LAB_ONLY.includes(f.split(sep)[0]))
    .map((f) => [f.split(sep).slice(0, -1).join("/"), JSON.parse(readFileSync(new URL(f, songsDir), "utf8"))]),
);

describe("reviewed levels", () => {
  it("has a row for every select chart, and no row for anything else", () => {
    expect([...charts.keys()].sort()).toEqual(Object.keys(reviewedLevels).sort());
  });

  it("keeps each row's old level equal to the chart's formula, so a re-chart flags its row", () => {
    for (const [id, c] of charts) expect(difficulty(c).formula, id).toBe(reviewedLevels[id].old);
  });

  it("gives each row a cited grade it maps to, or keeps the formula with a note", () => {
    for (const [id, row] of Object.entries(reviewedLevels)) {
      expect(Number.isInteger(row.level) && row.level >= 1 && row.level <= 15, id).toBe(true);
      if (row.grade) {
        expect(row.grade.url.startsWith("https://"), id).toBe(true);
        const mapped = mappedLevel(row.grade);
        expect(row.level <= mapped && row.level >= mapped - 2, `${id}: ${row.level} vs ${mapped}`).toBe(true);
        if (row.level < mapped) expect(row.note, id).toBeTruthy();
      } else {
        expect(row.level, id).toBe(row.old);
        expect(row.note, id).toBeTruthy();
      }
    }
  });

  it("gives each published chart its row's level, and its Easy chart no more", () => {
    for (const [id, c] of charts) {
      expect(c.id, id).toBe(id);
      expect(difficulty(c).level, id).toBe(reviewedLevels[id].level);
      expect(difficulty(easyChart(c)).level, id).toBeLessThanOrEqual(reviewedLevels[id].level);
    }
  });
});
