import { expect, test } from "vitest";
import type { Chart, Take } from "../../contracts";
import { validateTake } from "../../contracts";
import { Judge, judgeTake } from "./judge";
import { scoringVersion } from "./sustain";
import { recordKey } from "../records/store";
import { readTakeMidi, takeToMidi } from "../take-midi";
const chart: Chart = { id: "timing-probe", title: "Test", composer: "test", source: "synthetic", bpm: 120, beatsPerBar: 4, notes: [{ id: "n", pitch: 60, beat: 0, duration: 2, hand: "R" }] };
const take = (offset: number, version: 1 | 2 | 3): Take => ({ chartId: chart.id, startedAt: "2026-10-24T00:00:00Z", inputDevice: "test", latencyOffsetMs: 0, scoringVersion: version, events: [{ pitch: 60, velocity: 80, timeMs: offset, offTimeMs: 1000 }] });
test.each([-125, 125])("v3 accepts exact early/late edge%s in live and saved judge", offset => {
  const live = new Judge(chart, undefined, { scoringVersion: 3 });
  live.advance(offset); live.press(60, offset, 0); live.release(60, 1000);
  const saved = judgeTake(chart, take(offset, 3));
  expect(saved.counts.GOOD).toBe(1); expect(saved.judgments[0].offsetMs).toBe(offset);
  expect(live.finish(1100)).toEqual(saved);
});
test.each([-125.001, 125.001])("v3 rejects outside edge%s", offset => expect(judgeTake(chart, take(offset, 3)).counts.MISS).toBe(1));
test.each([1, 2] as const)("historical policy%s keeps100ms edge", version => {
  expect(judgeTake(chart, take(100, version)).counts.GOOD).toBe(1);
  expect(judgeTake(chart, take(100.001, version)).counts.MISS).toBe(1);
  expect(judgeTake(chart, take(-110, version)).counts.MISS).toBe(1);
});
test.each([[31.25, "PERFECT"], [31.251, "GREAT"], [62.5, "GREAT"], [62.501, "GOOD"]])("v3 differentiates tier edge%s", (offset, grade) => expect(judgeTake(chart, take(Number(offset), 3)).judgments[0].judgment).toBe(grade));
test("same-pitch repeats match once; wrong pitches never become hits", () => {
  const c = { ...chart, notes: [...chart.notes, { ...chart.notes[0], id: "second", beat: 1 }] };
  const j = new Judge(c, undefined, { scoringVersion: 3 });j.press(60, -125, 0);j.press(60, 625, 1);
  expect(j.finish(1000).counts.GOOD).toBe(2);
  const wrong = new Judge(chart, undefined, { scoringVersion: 3 });wrong.press(61, 0, 0);
  const result = wrong.finish(1100);expect(result.counts.MISS).toBe(1);expect(result.counts.wrong).toBe(1);
});
test("v3 inherits honest holds, no full bonus for a tap", () => {
  const t = take(0, 3);t.events[0].offTimeMs = 30;
  expect(judgeTake(chart, t).sustain?.earnedPoints).toBe(3);
  expect(judgeTake(chart, take(0, 3)).sustain?.earnedPoints).toBe(100);
  expect(judgeTake(chart, take(0, 3)).sustain).toEqual(judgeTake(chart, take(0, 2)).sustain);
});
test("new default3, explicit and historical policies, distinct records and MIDI round-trip", () => {
  expect(scoringVersion(new URLSearchParams())).toBe(3);
  expect(scoringVersion(new URLSearchParams("bot=take"))).toBe(1);
  for (const version of [1, 2, 3] as const) {
    expect(scoringVersion(new URLSearchParams(`scoring=${version}`))).toBe(version);
    expect(validateTake(take(0, version))).toEqual([]);
    const decoded = readTakeMidi(takeToMidi(chart, take(0, version)), chart);
    expect("error" in decoded).toBe(false);if (!("error" in decoded)) expect(decoded.scoringVersion).toBe(version);
  }
  const keys = [1, 2, 3].map(v => recordKey(chart.id, new URLSearchParams(), v as 1 | 2 | 3));
  expect(new Set(keys).size).toBe(3);
});
