// Every chart in web/public/songs/ (any depth, local songs included) against the library's rules, so a new song
// needs a folder and no test code. A failure names the chart (the test name) and each broken rule.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { expect, test } from "vitest";
import type { Chart, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";

const root = new URL("../../../public/songs", import.meta.url).pathname;
const files = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((f) => f.split(sep).pop() === "chart.json")
  .sort();

function problems(path: string, chart: Chart): string[] {
  const valid = validateChart(chart);
  if (valid.length) return valid.map((p) => `validateChart: ${p}`);
  const p: string[] = [];
  const folder = basename(dirname(path));
  if (folder !== chart.id) p.push(`id: "${chart.id}" but its folder is "${folder}"`);
  chart.notes.forEach((n, i) => {
    if (i && n.beat < chart.notes[i - 1].beat) p.push(`time order: ${n.id} (beat ${n.beat}) comes before ${chart.notes[i - 1].id}`);
    if (n.hand !== "R" && n.hand !== "L") p.push(`hand: ${n.id} has "${n.hand}"`);
    if (!(n.duration > 0)) p.push(`duration: ${n.id} has ${n.duration}`);
  });
  const byPitch = new Map<number, Chart["notes"]>();
  for (const n of chart.notes) byPitch.set(n.pitch, [...(byPitch.get(n.pitch) ?? []), n]);
  for (const same of byPitch.values()) {
    same.sort((a, b) => a.beat - b.beat);
    for (let i = 1; i < same.length; i++) {
      const a = same[i - 1];
      if (same[i].beat < a.beat + a.duration) p.push(`same-pitch overlap: ${a.id} and ${same[i].id} (pitch ${a.pitch})`);
    }
  }
  const take: Take = {
    chartId: chart.id,
    startedAt: "2026-10-24T00:00:00Z",
    latencyOffsetMs: 0,
    inputDevice: "test",
    events: chart.notes.map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: noteTimeMs(chart, n), offTimeMs: null })),
  };
  const r = judgeTake(chart, take);
  if (r.counts.PERFECT !== chart.notes.length || r.accuracy !== 1 || r.rank !== "S") {
    p.push(`Perfect player: ${r.counts.PERFECT}/${chart.notes.length} PERFECT, accuracy ${r.accuracy}, rank ${r.rank}`);
  }
  return p;
}

const charts = files.map((f) => ({ path: f, chart: JSON.parse(readFileSync(join(root, f), "utf8")) as Chart }));

test.each(charts)("songs/$path follows the library rules", ({ path, chart }) => {
  expect(problems(path, chart)).toEqual([]);
});

test("chart ids are unique across the library", () => {
  const seen = new Map<string, string>();
  const dupes = charts.flatMap(({ path, chart }) => {
    const other = seen.get(chart.id);
    seen.set(chart.id, path);
    return other ? [`"${chart.id}" in ${other} and ${path}`] : [];
  });
  expect(dupes).toEqual([]);
});
