import { expect, it } from "vitest";
import { LATENCY_MAX, LATENCY_MIN } from "../core/settings";
import { calibrate, clickTimes } from ".";

const clicks = clickTimes(0);
const tapAll = (offset: (i: number) => number) => clicks.map((c, i) => c + offset(i));

it("taps at a steady +30 ms give 30", () => {
  expect(calibrate(clicks, tapAll(() => 30))).toEqual({ ok: true, offsetMs: 30, spreadMs: 0, taps: 8 });
});

it("taps on the first 4 clicks are dropped, even 200 ms off", () => {
  expect(calibrate(clicks, tapAll((i) => (i < 4 ? 30 + 200 : 30)))).toMatchObject({ ok: true, offsetMs: 30 });
});

it("five paired taps save nothing", () => {
  expect(calibrate(clicks, clicks.slice(4, 9).map((c) => c + 30))).toMatchObject({ ok: false, reason: "too few", taps: 5 });
});

it("a spread of 60 ms saves nothing", () => {
  const r = calibrate(clicks, tapAll((i) => (i % 2 ? 60 : -60)));
  expect(r).toMatchObject({ ok: false, reason: "too spread", spreadMs: 60 });
});

it("an offset past the limit clamps to it", () => {
  expect(calibrate(clicks, tapAll(() => 200))).toMatchObject({ ok: true, offsetMs: LATENCY_MAX });
  expect(calibrate(clicks, tapAll(() => -200))).toMatchObject({ ok: true, offsetMs: LATENCY_MIN });
});

it("+400 ms is 200 ms early for the next click at 600 ms apart, so it reads as early and clamps to the minimum", () => {
  // Inherent to tapping along at 100 BPM: +400 and -200 are the same taps. The spec's Validation said +400 clamps to
  // LATENCY_MAX; it can't, so the spec now says +200 (see the PR).
  expect(calibrate(clicks, tapAll(() => 400))).toMatchObject({ ok: true, offsetMs: LATENCY_MIN });
});

it("taps further than 250 ms from every click don't pair", () => {
  expect(calibrate(clicks, tapAll(() => 300))).toMatchObject({ ok: false, reason: "too few", taps: 0 });
});
