import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { isBlack, makeLayout } from "../core/highway";
import { drawBlackKey, drawWhiteKey } from ".";
import { settings } from "../core/settings";

describe("keyX in a full 88-key layout", () => {
  // A0 and C8: the highway pads a whole white key past each end, so A0..C8 are all inside.
  const chart = { notes: [21, 108].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" })) } as unknown as Chart;
  const width = 1920;
  const L = makeLayout(chart, width, 1080, 0);
  const whites: number[] = [];
  for (let p = L.lowPitch; p <= L.highPitch; p++) if (!isBlack(p)) whites.push(p);
  const whiteW = width / whites.length;

  it("white keys tile the width in order, each one white key wide", () => {
    whites.forEach((p, i) => expect(L.keyX(p)).toEqual({ x: i * whiteW, width: whiteW }));
  });

  it("black keys are 0.6 of a white key, centered on the boundary after the white below", () => {
    for (let p = 21; p <= 108; p++) {
      if (!isBlack(p)) continue;
      const below = whites.indexOf(p - 1);
      const k = L.keyX(p);
      expect(k.width).toBeCloseTo(whiteW * 0.6, 9);
      expect(k.x + k.width / 2).toBeCloseTo((below + 1) * whiteW, 9);
    }
  });
});

describe("drawing", () => {
  const recorder = () => {
    const fills: string[] = [];
    const strokes: string[] = [];
    const bars: unknown[][] = [];
    const t: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(t, {
      get: (o, k) => (k in o ? o[k] : k === "stroke" ? () => strokes.push(String(o.strokeStyle)) : k === "fillRect" ? (...args: unknown[]) => { fills.push(String(o.fillStyle)); if (o.fillStyle === "#151020") bars.push(args); } : k === "fill" ? () => fills.push(String(o.fillStyle)) : () => ({ addColorStop() {} })),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, fills, strokes, bars };
  };
  const r = { x: 0, y: 0, w: 20, h: 100 };

  it("both pressed key types have saturated fill, contrasting outline and geometric marker", () => {
    for (const draw of [drawWhiteKey, drawBlackKey]) {
      const { ctx, fills, strokes, bars } = recorder();
      draw(ctx, r, "#6aa8ff");
      expect(fills[0]).toBe(settings.keyLitColor);
      expect(fills).toContain("#6aa8ff"); // hand accent remains
      expect(strokes).toEqual(["#151020", "#ffffff"]);
      expect(bars).toHaveLength(1);
      const [x, y, w, h] = bars[0] as number[];
      expect(x).toBeGreaterThan(r.x);
      expect(y).toBeGreaterThan(r.h / 2);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x + w).toBeLessThan(r.w);
      expect(y + h).toBeLessThan(r.h);
    }
  });

  it("an unpressed key never fills with a light", () => {
    for (const draw of [drawWhiteKey, drawBlackKey]) {
      const { ctx, fills, strokes, bars } = recorder();
      draw(ctx, r, null);
      expect(fills).not.toContain(settings.keyLitColor);
      expect(strokes).toEqual([]);
      expect(bars).toEqual([]);
      expect(fills).not.toContain("#6aa8ff");
      expect(fills).not.toContain("#ffffff");
    }
  });
});
