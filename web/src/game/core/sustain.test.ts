import { describe, expect, it } from "vitest";
import type { Chart, Take, TakeEvent } from "../../contracts";
import { validateTake } from "../../contracts";
import { Judge, judgeTake } from "./judge";
import { onsetLabel } from "./sustain";
import { pauseClock } from "../play-slots";

const chart: Chart = { id: "holds", title: "Holds", composer: "test", source: "test fixture", bpm: 120, beatsPerBar: 4, notes: [{ id: "long", pitch: 60, beat: 0, duration: 2, hand: "R" }] };
const event = (on: number, off: number | null, pitch = 60): TakeEvent => ({ pitch, velocity: 80, timeMs: on, offTimeMs: off });
const take = (events: TakeEvent[], version: 1 | 2 | null = 2): Take => ({ chartId: chart.id, startedAt: "2026-10-24T00:00:00Z", inputDevice: "midi", latencyOffsetMs: 0, ...(version === null ? {} : { scoringVersion: version }), events });

describe("explicit local hold policy", () => {
  it("legacy absent/1 results stay byte-equivalent and onset-only for taps/holds", () => {
    const old = judgeTake(chart, take([event(0, null)], null));
    expect(judgeTake(chart, take([event(0, 1000)], 1))).toEqual(old);
    expect(judgeTake(chart, take([event(0, 10)], null))).toEqual(old);
    expect(old.sustain).toBeUndefined();
  });
  it.each([[50, 5], [1000, 100], [5000, 100]])("release at %s gets %s bounded hold points", (off, points) => {
    const r = judgeTake(chart, take([event(0, off)]));
    expect(r.judgments[0].judgment).toBe("PERFECT");
    expect(r.sustain).toMatchObject({ earnedPoints: points, possiblePoints: 100 });
    expect(r.sustain!.notes[0].heldMs).toBe(Math.min(off, 1000));
  });
  it("does not invent duration at end or after a disconnect/retrigger gap", () => {
    expect(judgeTake(chart, take([event(0, null)])).sustain!.earnedPoints).toBe(0);
    const repeated = { ...chart, notes: [...chart.notes, { ...chart.notes[0], id: "second", beat: 2 }] };
    const r = judgeTake(repeated, take([event(0, null), event(1000, 2000)]));
    expect(r.sustain!.notes.map(n => n.earnedPoints)).toEqual([0, 100]);
    const live = new Judge(chart, undefined, { scoringVersion: 2 });
    live.press(60, 0, 0); live.cancel(60);
    expect(live.finish(2000).sustain!.earnedPoints).toBe(0);
  });
  it("keeps chords independent and does not penalize short notes as holds", () => {
    const chord = { ...chart, notes: [...chart.notes, { ...chart.notes[0], id: "chord", pitch: 64 }, { ...chart.notes[0], id: "short", pitch: 67, duration: .5 }] };
    const r = judgeTake(chord, take([event(0, 1000), event(0, 50, 64), event(0, 20, 67)]));
    expect(r.sustain!.notes.map(n => n.earnedPoints)).toEqual([100, 5]);
    expect(r.counts.PERFECT).toBe(3);
  });
  it("a real retrigger closes the preceding hold, old release cannot end the new hold", () => {
    const repeated = { ...chart, notes: [...chart.notes, { ...chart.notes[0], id: "second", beat: 2 }] };
    const r = judgeTake(repeated, take([event(0, 1500), event(1000, 2000)]));
    expect(r.sustain!.notes.map(n => n.earnedPoints)).toEqual([100, 100]);
  });
  it.each([-100, -50, 0, 50, 100])("accepts the existing first-note onset window at %sms", shift => {
    const r = judgeTake(chart, take([event(shift, 1000)]));
    expect(r.counts.MISS).toBe(0);
    expect(r.judgments[0].offsetMs).toBe(shift);
    expect(onsetLabel(r.judgments[0].judgment, shift)).toContain(shift < 0 ? "EARLY" : shift > 0 ? "LATE" : "ON TIME");
  });
  it("never turns arbitrarily early input into a hit", () => {
    expect(judgeTake(chart, take([event(-101, 1000)])).counts.MISS).toBe(1);
  });
  it("validates policy and release direction without changing legacy validation", () => {
    expect(validateTake({ ...take([]), scoringVersion: 4 })).toContain("scoringVersion must be 1, 2 or 3");
    expect(validateTake(take([event(20, 10)]))).toContain("event 0: release precedes press");
    expect(validateTake(take([event(20, 10)], null))).toEqual([]);
  });
});

it.each([false, true])("pause freezes credit; released during pause=%s matches server evaluation", releasedDuringPause => {
  const clock = pauseClock(0);
  const judge = new Judge(chart, undefined, { scoringVersion: 2 });
  judge.press(60, clock.now(0), 0);
  clock.pause(400);
  expect(judge.sustainAt(clock.now(5400))!.earnedPoints).toBe(40);
  const releaseAt = releasedDuringPause ? clock.now(3000) : 1000;
  if (releasedDuringPause) judge.release(60, releaseAt);
  clock.resume(5400);
  if (!releasedDuringPause) judge.release(60, clock.now(6000));
  const result = judge.finish(clock.now(6200));
  expect(result.sustain!.earnedPoints).toBe(releasedDuringPause ? 40 : 100);
  expect(result).toEqual(judgeTake(chart, take([event(0, releaseAt)])));
});

it.each([100, 70])("hold credit is tempo-independent in simple/compound meter at%s percent", percent => {
  for (const [bpm, beatsPerBar] of [[100, 4], [60, 6]]) {
    const c = { ...chart, bpm: bpm * percent / 100, beatsPerBar };
    const target = 2 * 60000 / c.bpm;
    expect(judgeTake(c, take([event(0, target)])).sustain!.earnedPoints).toBe(100);
    expect(judgeTake(c, take([event(0, target - .1)])).sustain!.earnedPoints).toBe(99);
  }
});
