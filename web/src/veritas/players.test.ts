import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, test } from "vitest";
import type { Chart } from "../contracts";
import { judgeTake } from "../game/core/judge";
import { rubato } from "../game/tempo-curve";
import { chordRoller, fumbler, golden, jitter, rusher, RUSH, tally, type Run } from "./players";

// Every committed chart: web/public/songs/<id>/chart.json, not local/.
const songs = join(__dirname, "../../public/songs");
const charts: Chart[] = readdirSync(songs)
  .filter((d) => d !== "local")
  .flatMap((d) => {
    try {
      return [JSON.parse(readFileSync(join(songs, d, "chart.json"), "utf8")) as Chart];
    } catch {
      return [];
    }
  });
const chart = (id: string) => charts.find((c) => c.id === id)!;
const judged = (c: Chart, run: Run) => tally(c, run, judgeTake(c, run.take));

test("the charts are there", () => {
  expect(charts.length).toBeGreaterThanOrEqual(10);
  expect(["twinkle", "fur-elise", "ode-to-joy", "chopin-prelude-4"].every((id) => chart(id))).toBe(true);
});

describe.each(charts.map((c) => [c.id, c] as const))("%s", (_, c) => {
  for (const [name, player] of [["golden", golden], ["jitter", jitter], ["fumbler", fumbler], ["chordRoller", chordRoller]] as const) {
    test(`${name}: found = planted, 0 false alarms`, () => {
      const t = judged(c, player(c));
      expect({ found: t.found, falseAlarms: t.falseAlarms }).toEqual({ found: t.planted, falseAlarms: 0 });
    });
  }
  test("fumbler plants on a chart of 10+ notes", () => {
    expect(c.notes.length).toBeGreaterThanOrEqual(10);
    expect(fumbler(c).planted.length).toBeGreaterThan(0);
  });
  test("jitter plants early and late", () => {
    const kinds = new Set(jitter(c).planted.map((p) => p.kind));
    expect(kinds).toEqual(new Set(["early", "late"]));
  });
});

test("chord roller plants on every chart with a safe chord", () => {
  const rolled = charts.filter((c) => chordRoller(c).planted.length > 0).map((c) => c.id);
  // Which charts have one comes from the charts themselves; at least the chord-heavy prelude does.
  expect(rolled).toContain("chopin-prelude-4");
  for (const id of rolled) expect(judged(chart(id), chordRoller(chart(id))).found).toBe(chordRoller(chart(id)).planted.length);
});

test("golden on Für Elise: 2 planted, 2 found, 0 false alarms, 2 WRONG", () => {
  const c = chart("fur-elise");
  const run = golden(c);
  const results = judgeTake(c, run.take);
  const t = tally(c, run, results);
  expect([t.planted, t.found, t.falseAlarms]).toEqual([2, 2, 0]);
  expect(results.counts.wrong).toBe(2);
});

test("jitter: the same seed gives the same take, another seed another", () => {
  const c = chart("ode-to-joy");
  expect(jitter(c, 7).take).toEqual(jitter(c, 7).take);
  expect(jitter(c, 7).take).not.toEqual(jitter(c, 8).take);
  expect(jitter(c).take).toEqual(jitter(c, 1).take);
});

test("a planted mistake the judge misses shows: a jittered note put back on time is not found", () => {
  const c = chart("ode-to-joy");
  const run = jitter(c);
  const p = run.planted[0];
  if (p.kind !== "early" && p.kind !== "late") throw new Error("expected early or late");
  run.take.events[p.note].timeMs -= p.offsetMs;
  const t = judged(c, run);
  expect(t.found).toBe(t.planted - 1);
});

test("an unplanted mistake is a false alarm: one extra wrong press", () => {
  const c = chart("twinkle");
  const run = fumbler(c);
  const n = c.notes[0];
  run.take.events.push({ pitch: n.pitch + 6, velocity: 80, timeMs: (n.beat + 2) * (60000 / c.bpm), offTimeMs: null });
  expect(judged(c, run).falseAlarms).toBe(1);
});

test("rusher: one tempo plant, which the judge has no flag for", () => {
  const t = judged(chart("twinkle"), rusher(chart("twinkle")));
  expect([t.planted, t.found, t.falseAlarms]).toEqual([1, null, 0]);
});

// Fails today: no rushing measure exists (#545). It turns red once one lands, and becomes a plain test.
it.fails("rusher on Twinkle: rubato's BPM range is within 1 of 115% of the chart's (#545)", () => {
  const c = chart("twinkle");
  const run = rusher(c);
  const range = rubato(c, run.take, judgeTake(c, run.take)).bpmRange;
  const want = Math.round(RUSH * c.bpm);
  expect(range).not.toBeNull();
  expect(Math.abs(range![0] - want)).toBeLessThanOrEqual(1);
  expect(Math.abs(range![1] - want)).toBeLessThanOrEqual(1);
});
