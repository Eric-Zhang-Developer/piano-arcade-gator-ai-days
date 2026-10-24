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
