// Every chart in web/public/songs/ (any depth, local songs included) against the library's rules, so a new song
// needs a folder and no test code. A failure names the chart (the test name) and each broken rule. Each rule is pinned
// by a synthetic chart that breaks only it (chart-lint), and CHART_LINT_TABLE=1 prints the library as a table.
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, sep } from "node:path";
import { describe, expect, test } from "vitest";
import type { Chart, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";

const root = new URL("../../../public/songs", import.meta.url).pathname;
// One hand at one onset wider than a major 10th (16 semitones) is unplayable for most hands: a converter's mistake.
const MAX_SPAN = 16;

// Each hand's notes that start together, and how far apart they reach.
function onsetSpans(chart: Chart) {
  const groups = new Map<string, Chart["notes"]>();
  for (const n of chart.notes) groups.set(`${n.beat} ${n.hand}`, [...(groups.get(`${n.beat} ${n.hand}`) ?? []), n]);
  return [...groups.values()].map((g) => {
    const pitches = g.map((n) => n.pitch);
    return { beat: g[0].beat, hand: g[0].hand, span: Math.max(...pitches) - Math.min(...pitches), ids: g.map((n) => n.id) };
  });
}

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

describe("each rule fires on a chart that breaks only it", () => {
  // Twinkle's opening, both hands, clean: C4 and the left hand's C3–E3 together, then G4 and D4.
  const clean = (): Chart => ({
    id: "lint",
    title: "Lint",
    composer: "test",
    source: "synthetic",
    bpm: 120,
    beatsPerBar: 4,
    notes: [
      { id: "r1", pitch: 60, beat: 0, duration: 1, hand: "R" },
      { id: "l1", pitch: 48, beat: 0, duration: 1, hand: "L" },
      { id: "l2", pitch: 52, beat: 0, duration: 1, hand: "L" },
      { id: "r2", pitch: 67, beat: 1, duration: 1, hand: "R" },
      { id: "r3", pitch: 62, beat: 2, duration: 2, hand: "R" },
    ],
  });
  const lint = (c: Chart) => problems("lint/chart.json", c);
  const broken = (edit: (c: Chart) => void) => {
    const c = clean();
    edit(c);
    return lint(c);
  };

  test("a clean chart has no problems", () => {
    expect(lint(clean())).toEqual([]);
  });
  test("same-pitch overlap", () => {
    expect(broken((c) => c.notes.push({ id: "r4", pitch: 62, beat: 3, duration: 1, hand: "R" }))).toContain(
      "same-pitch overlap: r3 and r4 (pitch 62)",
    );
  });
  test("pitch range (validateChart, by index)", () => {
    expect(broken((c) => (c.notes[3].pitch = 109))).toEqual(["validateChart: note 3: pitch out of 21–108"]);
  });
  test("duplicate id (validateChart, by index)", () => {
    expect(broken((c) => (c.notes[4].id = "r2"))).toEqual(["validateChart: note 4: id missing or duplicate"]);
  });
  test("time order", () => {
    expect(broken((c) => c.notes.reverse())).toContain("time order: r2 (beat 1) comes before r3");
  });
  test("hand span: a 17-semitone left hand fails, the 16 of a major 10th passes", () => {
    expect(broken((c) => (c.notes[2].pitch = 65))).toEqual(["hand span: beat 0, L hand spans 17 semitones (l1, l2)"]);
    expect(broken((c) => (c.notes[2].pitch = 64))).toEqual([]);
  });
});

// CHART_LINT_TABLE=1 pnpm -C web test library: one Markdown row per chart, for a PR or a person.
test.runIf(process.env.CHART_LINT_TABLE === "1")("the library table", () => {
  const rows = charts.map(({ chart }) => {
    const pitches = chart.notes.map((n) => n.pitch);
    const bars = Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar);
    const widest = onsetSpans(chart).reduce((w, o) => (o.span > w.span ? o : w));
    return `| ${chart.id} | ${chart.notes.length} | ${bars} | ${Math.min(...pitches)} | ${Math.max(...pitches)} | ${widest.span ? `${widest.span} (${widest.hand}, beat ${widest.beat})` : "0"} |`;
  });
  // stdout, not console.log: vitest hides a passing test's console output.
  process.stdout.write(["| Chart | Notes | Bars | Lowest | Highest | Widest one-hand span |", "|---|---|---|---|---|---|", ...rows, ""].join("\n"));
});
