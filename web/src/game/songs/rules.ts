// The library's rules for one chart (spec: chart-lint), shared by the library test and level-forge's check, so a
// forged chart meets exactly the rules a committed one does.
import { basename, dirname } from "node:path";
import type { Chart, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";

// One hand at one onset wider than a major 10th (16 semitones) is unplayable for most hands: a converter's mistake.
export const MAX_SPAN = 16;

// Each hand's notes that start together, and how far apart they reach.
export function onsetSpans(chart: Chart) {
  const groups = new Map<string, Chart["notes"]>();
  for (const n of chart.notes) groups.set(`${n.beat} ${n.hand}`, [...(groups.get(`${n.beat} ${n.hand}`) ?? []), n]);
  return [...groups.values()].map((g) => {
    const pitches = g.map((n) => n.pitch);
    return { beat: g[0].beat, hand: g[0].hand, span: Math.max(...pitches) - Math.min(...pitches), ids: g.map((n) => n.id) };
  });
}

// Every rule a chart breaks, by name; empty when it follows them all. path is the chart's path under songs/, for the
// folder-matches-id rule.
export function chartProblems(path: string, chart: Chart): string[] {
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
  for (const o of onsetSpans(chart))
    if (o.span > MAX_SPAN) p.push(`hand span: beat ${o.beat}, ${o.hand} hand spans ${o.span} semitones (${o.ids.join(", ")})`);
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
