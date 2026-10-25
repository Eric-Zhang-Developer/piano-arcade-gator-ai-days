// level-forge's check (spec: level-forge): the library's rules, imported rather than copied, on one forged chart.
// game-tools/forge/forge.py runs this file by name with FORGE_CHART (the scratch chart) and FORGE_ID (its id); in a
// normal test run there's no chart, so it skips.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Chart } from "../../../contracts";
import { chartProblems } from "../../../game/songs/rules";

const path = process.env.FORGE_CHART;
const id = process.env.FORGE_ID;

test.runIf(!!path)("the forged chart follows the library rules", () => {
  const chart = JSON.parse(readFileSync(path!, "utf8")) as Chart;
  // As it will sit once saved: songs/local/<id>/chart.json, so the folder-matches-id rule applies.
  expect(chartProblems(`local/${id}/chart.json`, chart)).toEqual([]);
});
