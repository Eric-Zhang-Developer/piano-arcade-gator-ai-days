import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { isBlack, makeLayout } from "../core/highway";
import { brightness, pillRect } from ".";

describe("pillRect", () => {
  // A C major scale plus C♯ and F♯, laid out by the real highway.
  const chart = { notes: [60, 61, 62, 64, 65, 66, 67].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" })) } as unknown as Chart;
  const L = makeLayout(chart, 1280, 720, 0);
  const pill = (p: number) => pillRect(L.keyX(p), isBlack(p));

  it("a black-key note is about 56% the width of a white-key note", () => {
    expect(pill(61).width / pill(60).width).toBeCloseTo(0.56, 2);
    expect(pill(66).width / pill(65).width).toBeCloseTo(0.56, 2);
  });

  it("stays centered in its key", () => {
    for (const p of [60, 61, 66]) {
      const k = L.keyX(p);
      expect(pill(p).x + pill(p).width / 2).toBeCloseTo(k.x + k.width / 2, 6);
    }
  });

  it("has rounded ends", () => {
    expect(pill(60).radius).toBeGreaterThan(0);
    expect(pill(60).radius).toBeLessThanOrEqual(pill(60).width / 2);
  });
});

describe("brightness", () => {
  it("is about 35% at the top of the lookahead and 100% at the line", () => {
    expect(brightness(2000, 2000)).toBeCloseTo(0.35, 6);
    expect(brightness(0, 2000)).toBe(1);
    expect(brightness(5000, 2000)).toBeCloseTo(0.35, 6);
    expect(brightness(-300, 2000)).toBe(1);
  });

  it("only rises as the note falls", () => {
    let last = -Infinity;
    for (let ms = 2400; ms >= -400; ms -= 50) {
      const b = brightness(ms, 2000);
      expect(b).toBeGreaterThanOrEqual(last);
      last = b;
    }
  });
});
