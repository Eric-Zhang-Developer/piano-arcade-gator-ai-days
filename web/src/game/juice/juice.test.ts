import { expect, it } from "vitest";
import type { Chart, Frame, Hand } from "../../contracts";
import { handColor } from "../hand-colors";
import { settings } from "../core/settings";
import { juiceVisual } from ".";

// A 2D context that records every gradient stop's color and every fill style, and ignores the rest.
function recorder() {
  const colors: string[] = [];
  const gradient = { addColorStop: (_: number, c: string) => colors.push(c) };
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get: (t, k) =>
      k in t ? t[k] : k === "createLinearGradient" || k === "createRadialGradient" ? () => gradient : k === "fillRect" ? () => colors.push(String(t.fillStyle)) : () => {},
    set: (t, k, v) => ((t[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, colors };
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255},`;
};

const chart = (hands: Hand[]): Chart => ({
  id: "t",
  title: "t",
  composer: "t",
  source: "test",
  bpm: 120,
  beatsPerBar: 4,
  notes: hands.map((hand, i) => ({ id: `n${i}`, pitch: 48 + i * 12, beat: i, duration: 1, hand })),
});

// Hit note n1 (pitch 60) at its time, then draw one frame just after.
function burst(c: Chart) {
  const p = juiceVisual();
  p.transformChart!(c, new URLSearchParams());
  p.onEvent!({ type: "noteHit", noteId: "n1", pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: 500 });
  const { ctx, colors } = recorder();
  const frame = { nowMs: 520, width: 800, height: 600, judgmentLineY: 500, keyX: () => ({ x: 100, width: 20 }) } as unknown as Frame;
  p.draw!(ctx, frame);
  p.draw!(ctx, { ...frame, nowMs: 560 }); // wisps spawned last frame, now drawn
  return colors;
}

it("a left-hand hit's flare, pillar and wisps take the left hand's color", () => {
  const colors = burst(chart(["R", "L"]));
  expect(colors.some((c) => c.startsWith(rgb(handColor("L"))))).toBe(true);
  expect(colors.some((c) => c.startsWith(rgb(handColor("R"))))).toBe(false);
});

it("a one-hand chart's burst keeps today's note color", () => {
  const colors = burst(chart(["L", "L"]));
  expect(colors.some((c) => c.startsWith(rgb(settings.noteColor)))).toBe(true);
  expect(colors.some((c) => c.startsWith(rgb(handColor("L"))))).toBe(false);
});

it("fever's edges stop above the 500 ms mark, so they never cover the edge lanes' next notes (#280)", () => {
  for (const [width, height, line] of [
    [1024, 768, 590],
    [1280, 720, 560],
    [1920, 1080, 842],
  ]) {
    const p = juiceVisual();
    p.transformChart!(chart(["R", "R"]), new URLSearchParams());
    p.onEvent!({ type: "feverStart", atMs: 0 });
    const fills: { y: number; h: number; op: string }[] = [];
    const t: Record<string | symbol, unknown> = { globalCompositeOperation: "source-over" };
    const gradient = { addColorStop: () => {} };
    const ctx = new Proxy(t, {
      get: (o, k) =>
        k in o
          ? o[k]
          : k === "createLinearGradient" || k === "createRadialGradient"
            ? () => gradient
            : k === "fillRect"
              ? (_x: number, y: number, _w: number, h: number) => fills.push({ y, h, op: String(o.globalCompositeOperation) })
              : () => {},
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    p.draw!(ctx, { nowMs: 10, width, height, judgmentLineY: line, keyX: () => ({ x: 0, width: 20 }) } as unknown as Frame);
    const painted = fills.filter((f) => f.op !== "destination-out");
    expect(painted.length).toBeGreaterThan(0);
    for (const f of painted) expect(f.y + f.h).toBeLessThanOrEqual(line * (1 - 500 / settings.lookaheadMs) + 1e-9);
  }
});
