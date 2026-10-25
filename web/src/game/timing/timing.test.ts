import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Chart, Take, TakeEvent } from "../../contracts";
import { judgeTake, noteTimeMs } from "../core/judge";
import { describeTiming, timingSummary } from "./index";

const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const N = chart.notes.length;

// One press per note at the given offset (or none for null), plus any extra presses.
function play(offset: (i: number) => number | null, pitchShift: (i: number) => number = () => 0, more: TakeEvent[] = []) {
  const events: TakeEvent[] = chart.notes.flatMap((n, i) => {
    const o = offset(i);
    return o === null ? [] : [{ pitch: n.pitch + pitchShift(i), velocity: 80, timeMs: noteTimeMs(chart, n) + o, offTimeMs: null }];
  });
  const take: Take = { chartId: chart.id, startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: 0, inputDevice: "test", events: [...events, ...more] };
  return timingSummary(chart, take, judgeTake(chart, take), 0);
}

test("Perfect player: every press timed, on time, nothing to suggest", () => {
  const s = play(() => 0);
  expect(s).toMatchObject({ timed: N, meanMs: 0, sdMs: 0, early: 0, late: 0, misses: 0, suggestedLatencyMs: null });
  expect(describeTiming(s)).toEqual(["On time on average, spread ±0 ms", "0 early · 0 late"]);
});

test("Late40: late by 40, suggests a latency offset of 40", () => {
  const s = play(() => 40);
  expect(s).toMatchObject({ timed: N, meanMs: 40, sdMs: 0, early: 0, late: N, suggestedLatencyMs: 40 });
  expect(describeTiming(s)[0]).toBe("Late by 40 ms on average, spread ±0 ms");
});

test("a press 130 ms late is a near miss and counts toward the mean", () => {
  const s = play((i) => (i === 4 ? 130 : 0));
  expect(s).toMatchObject({ timed: N, misses: 1, nearMisses: 1, late: 1 });
  expect(s.meanMs).toBe(Math.round(130 / N));
  expect(describeTiming(s)[2]).toBe("1 of 1 miss was within 150 ms");
});

test("a press 100 ms late is a GOOD hit, not a near miss", () => {
  const s = play((i) => (i === 4 ? 100 : 0));
  expect(s).toMatchObject({ timed: N, misses: 0, nearMisses: 0, late: 1 });
});

test("a press 200 ms late is a miss with no near miss, left out of the mean", () => {
  const s = play((i) => (i === 4 ? 200 : 0));
  expect(s).toMatchObject({ timed: N - 1, meanMs: 0, misses: 1, nearMisses: 0 });
});

test("a wrong-pitch press is never timed", () => {
  const s = play(() => 0, (i) => (i === 4 ? 1 : 0));
  expect(s).toMatchObject({ timed: N - 1, misses: 1, nearMisses: 0 });
});

test("two presses near one missed note: only the nearest counts", () => {
  const n = chart.notes[20];
  const t = noteTimeMs(chart, n);
  const s = play(
    (i) => (i === 20 ? null : 0),
    () => 0,
    [
      { pitch: n.pitch, velocity: 80, timeMs: t + 140, offTimeMs: null },
      { pitch: n.pitch, velocity: 80, timeMs: t - 130, offTimeMs: null },
    ],
  );
  expect(s).toMatchObject({ timed: N, misses: 1, nearMisses: 1, early: 1 });
});

test("fewer than 3 timed presses: no numbers", () => {
  const s = play((i) => (i < 2 ? 0 : null));
  expect(s).toMatchObject({ timed: 2, meanMs: null, sdMs: null, suggestedLatencyMs: null });
  expect(describeTiming(s)).toEqual(["Not enough timed presses"]);
});

test("the suggestion adds the mean to the current offset and stays within -150…150", () => {
  const events: TakeEvent[] = chart.notes.map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: noteTimeMs(chart, n) - 30, offTimeMs: null }));
  const take: Take = { chartId: chart.id, startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: -140, inputDevice: "test", events };
  expect(timingSummary(chart, take, judgeTake(chart, take), -140).suggestedLatencyMs).toBe(-150);
  expect(timingSummary(chart, take, judgeTake(chart, take), 20).suggestedLatencyMs).toBe(-10);
});

test("sub-ms clock noise is neither early nor late; a press that rounds to -1 ms is early", () => {
  const noise = [0.4, -0.4, 0.49, -0.3, 0.2];
  const s = play((i) => noise[i % noise.length]);
  expect(s).toMatchObject({ timed: N, meanMs: 0, sdMs: 0, early: 0, late: 0 });
  expect(play((i) => (i === 0 ? -0.6 : 0))).toMatchObject({ early: 1, late: 0 });
});
