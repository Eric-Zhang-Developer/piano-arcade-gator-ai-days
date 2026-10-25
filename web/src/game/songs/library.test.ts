// Every chart in web/public/songs/ (any depth, local songs included) against the library's rules, so a new song
// needs a folder and no test code. A failure names the chart (the test name) and each broken rule. Each rule is pinned
// by a synthetic chart that breaks only it (chart-lint), and CHART_LINT_TABLE=1 prints the library as a table.
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, test } from "vitest";
import type { Chart } from "../../contracts";
import { chartProblems, onsetSpans } from "./rules";

const root = new URL("../../../public/songs", import.meta.url).pathname;
const files = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((f) => f.split(sep).pop() === "chart.json")
  .sort();

const charts = files.map((f) => ({ path: f, chart: JSON.parse(readFileSync(join(root, f), "utf8")) as Chart }));

test.each(charts)("songs/$path follows the library rules", ({ path, chart }) => {
  expect(chartProblems(path, chart)).toEqual([]);
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
  const lint = (c: Chart) => chartProblems("lint/chart.json", c);
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
  test("folder matches id, at any depth under songs/", () => {
    expect(chartProblems("songs/x/lint/chart.json", clean())).toEqual([]);
    expect(chartProblems("songs/x/other/chart.json", clean())).toEqual(['id: "lint" but its folder is "other"']);
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
