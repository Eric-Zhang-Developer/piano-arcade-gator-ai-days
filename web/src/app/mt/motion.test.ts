import { expect, test } from "vitest";
import { cardPose, centreIndex, coverflowSettings, flickTarget, foldOffset } from "./motion";

test("offsets fold the short way round the ring", () => {
  expect(foldOffset(3, 0, 11)).toBe(3);
  expect(foldOffset(10, 0, 11)).toBe(-1);
  expect(foldOffset(0, 10, 11)).toBe(1); // past the last song, the first is next
  expect(foldOffset(0, 10.5, 11)).toBeCloseTo(0.5);
  expect(foldOffset(5, -0.25, 11)).toBeCloseTo(5.25);
});

test("the centred card is flat and full; neighbours tilt toward the centre and recede", () => {
  const c = cardPose(0, 11, 200);
  expect([c.x, c.z, c.tilt, c.opacity]).toEqual([0, -0, -0, 1]);
  const r = cardPose(1, 11, 200);
  expect(r.tilt).toBe(-44);
  expect(r.z).toBeCloseTo(-120);
  expect(r.opacity).toBeCloseTo(0.9);
  expect(cardPose(-1, 11, 200).tilt).toBe(44);
  expect(r.layer).toBeGreaterThan(cardPose(2, 11, 200).layer);
});

test("tilt is capped at 82 degrees", () => {
  expect(Math.abs(cardPose(2, 40, 200).tilt)).toBeLessThan(coverflowSettings.maxTilt); // 44 * 2^0.56 ≈ 65
  expect(cardPose(4, 40, 200).tilt).toBe(-82); // 44 * 4^0.56 ≈ 95, capped
  expect(cardPose(-30, 80, 200).tilt).toBe(82);
});

test("a card is fully faded by half a ring away", () => {
  expect(cardPose(5.5, 11, 200).opacity).toBe(0);
  expect(cardPose(-5.5, 11, 200).opacity).toBe(0);
  expect(cardPose(4.5, 11, 200).opacity).toBeCloseTo(0.55);
  expect(cardPose(1.5, 3, 200).opacity).toBe(0);
});

test("a flick carries at most two cards and lands on a whole card", () => {
  expect(flickTarget(3.2, 0)).toBe(3);
  expect(flickTarget(3.2, 40)).toBe(5);
  expect(flickTarget(3.2, -40)).toBe(1);
  expect(flickTarget(3.2, 4)).toBe(4);
});

test("the centre index wraps both ways", () => {
  expect(centreIndex(0.4, 11)).toBe(0);
  expect(centreIndex(11, 11)).toBe(0);
  expect(centreIndex(-1, 11)).toBe(10);
  expect(centreIndex(3.6, 11)).toBe(4);
});
