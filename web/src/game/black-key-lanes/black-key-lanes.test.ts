import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { makeLayout } from "../core/highway";
import { blackKeyLaneSettings, drawBlackKeyLanes } from ".";

const chart = { notes: [{ pitch: 60 }, { pitch: 72 }] } as Chart; // C4–C5; core pads it to B3–D5

// Records each fill as its style and the x of its first point at the line.
function recorder() {
  const fills: string[] = [];
  let xs: number[] = [];
  const o: Record<string, unknown> = {
    beginPath: () => (xs = []),
    moveTo: () => {},
    lineTo: (x: number) => xs.push(x),
    closePath: () => {},
    fill: () => fills.push(`${String(o.fillStyle)} ${xs[1]}`),
  };
  return { ctx: o as unknown as CanvasRenderingContext2D, fills };
}

describe("drawBlackKeyLanes", () => {
  it("fills one lane per black key in view, C♯4 to C♯5, each at its key's x", () => {
    const L = makeLayout(chart, 900, 600, 0.2);
    const { ctx, fills } = recorder();
    drawBlackKeyLanes(ctx, L);
    expect(fills).toEqual([61, 63, 66, 68, 70, 73].map((p) => `rgba(255,255,255,${blackKeyLaneSettings.tint}) ${L.keyX(p).x + L.keyX(p).width}`));
  });

  it("stays at or under 0.04 luma over black, and draws nothing at tint 0", () => {
    expect(blackKeyLaneSettings.tint).toBeLessThanOrEqual(0.04);
    const { ctx, fills } = recorder();
    drawBlackKeyLanes(ctx, makeLayout(chart, 900, 600, 0.2), 0);
    expect(fills).toEqual([]);
  });
});
