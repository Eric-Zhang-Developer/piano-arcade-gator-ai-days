import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../contracts";
import { feverGauge, meterLayout } from ".";
import { hudLayout } from "../hud";
import { emptyGauge, gaugeSize, reduceGauge } from "./gauge";

const hit = (judgment: "PERFECT" | "GREAT" | "GOOD"): GameEvent => ({ type: "noteHit", noteId: "n", pitch: 60, judgment, offsetMs: 0, atMs: 0 });
const miss: GameEvent = { type: "noteMiss", noteId: "n", pitch: 60, atMs: 0 };
const wrong: GameEvent = { type: "wrongNote", pitch: 61, atMs: 0 };
const run = (notes: number, events: GameEvent[]) => events.reduce(reduceGauge, emptyGauge(notes));

describe("fever gauge", () => {
  it("is full at a quarter of the notes, from 12 to 50", () => {
    expect([42, 200, 1000].map(gaugeSize)).toEqual([12, 50, 50]);
  });

  it("twelve PERFECTs fill Twinkle's gauge and start fever; eleven don't", () => {
    expect(run(42, Array(11).fill(hit("PERFECT")))).toEqual({ size: 12, fill: 11, fever: false });
    expect(run(42, Array(12).fill(hit("PERFECT")))).toEqual({ size: 12, fill: 12, fever: true });
  });

  it("a GREAT adds half, a GOOD adds nothing and breaks nothing", () => {
    expect(run(42, [hit("PERFECT"), hit("GREAT"), hit("GOOD")]).fill).toBe(1.5);
  });

  it("before fever, a MISS or WRONG at 10 leaves 5", () => {
    const ten = Array(10).fill(hit("PERFECT"));
    expect(run(42, [...ten, miss]).fill).toBe(5);
    expect(run(42, [...ten, wrong]).fill).toBe(5);
  });

  it("a combo break during fever ends it and empties the gauge; it can start again once refilled", () => {
    const twelve = Array(12).fill(hit("PERFECT"));
    expect(run(42, [...twelve, hit("PERFECT"), miss])).toEqual({ size: 12, fill: 0, fever: false });
    expect(run(42, [...twelve, wrong, ...twelve]).fever).toBe(true);
  });
});

describe("fever meter", () => {
  it("sits under the HUD's panel and above its safe line, at 1280×720 and 1920×1080", () => {
    for (const [w, line] of [[1280, 600], [1920, 900], [800, 300]]) {
      const l = meterLayout(w, line);
      expect(l.bar.y).toBe(hudLayout(w, line).panel.h);
      expect(l.bottom).toBeLessThan(hudLayout(w, line).safeY);
    }
  });
});

describe("the meter in wait mode", () => {
  it("draws nothing", () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (o, k) => (k in o ? o[k] : () => calls.push(String(k))),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const draw = (params: string) => {
      calls.length = 0;
      const p = feverGauge();
      p.transformChart!({ notes: Array(42).fill({}) } as never, new URLSearchParams(params));
      p.draw!(ctx, { width: 1280, height: 720, judgmentLineY: 560, nowMs: 0 } as never);
      return [...calls];
    };
    expect(draw("")).toContain("fillRect");
    expect(draw("mode=wait")).toEqual([]);
  });
});
