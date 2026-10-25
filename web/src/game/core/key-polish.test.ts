import { describe, expect, it } from "vitest";
import type { Chart, Judgment } from "../../contracts";
import { drawHighway, makeLayout, notePolish, type HighwayState } from "./highway";
import { settings } from "./settings";

// key-polish's draw math in the highway: a released key's light fades, a held note feeds into its key, and a note
// glows as it nears the line.

// One right-hand note on middle C, four beats long at 120 bpm (500 ms a beat), so it lasts 0–2000 ms.
const chart: Chart = { id: "t", title: "t", composer: "t", source: "test", bpm: 120, beatsPerBar: 4, notes: [{ id: "a", pitch: 60, beat: 0, duration: 4, hand: "R" }] };
const L = makeLayout(chart, 800, 600, 0);

// A 2D context that records "<fillStyle> <shadowBlur>" for every fill and fillRect. One recorder is one canvas, so the
// highway's per-canvas release memory carries across its draws.
const recorder = () => {
  const fills: string[] = [];
  const t: Record<string | symbol, unknown> = { shadowBlur: 0 };
  const ctx = new Proxy(t, {
    get: (o, k) => (k in o ? o[k] : k === "fill" || k === "fillRect" ? () => fills.push(`${String(o.fillStyle)} ${o.shadowBlur}`) : () => ({ width: 0, addColorStop() {} })),
    set: (o, k, v) => ((o[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
};
const state = (s: Partial<HighwayState>): HighwayState => ({ nowMs: 0, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null, ...s });
const solid = (fills: string[], color: string) => fills.filter((f) => f.startsWith(`${color} `));

describe("a released key's light (key-polish)", () => {
  // A key that hit no note lights in keyLitColor; the note is long past, so nothing else fills with it.
  const at = (ctx: CanvasRenderingContext2D, fills: string[], nowMs: number, pressed: number[]) => {
    fills.length = 0;
    drawHighway(ctx, L, chart, state({ nowMs, pressed: new Set(pressed) }));
    return solid(fills, settings.keyLitColor).length;
  };

  it("fades over releaseMs after the key comes up, instead of cutting", () => {
    const { ctx, fills } = recorder();
    expect(at(ctx, fills, 5000, [64])).toBeGreaterThan(0);
    expect(at(ctx, fills, 5010, [])).toBeGreaterThan(0); // released: still lit, fading
    expect(at(ctx, fills, 5010 + notePolish.releaseMs - 1, [])).toBeGreaterThan(0);
    expect(at(ctx, fills, 5010 + notePolish.releaseMs, [])).toBe(0); // gone
  });

  it("a key that was never pressed never lights", () => {
    const { ctx, fills } = recorder();
    expect(at(ctx, fills, 5000, [])).toBe(0);
    expect(at(ctx, fills, 5010, [])).toBe(0);
  });
});

describe("a held note (key-polish)", () => {
  const hit = new Map<string, Judgment>([["a", "PERFECT"]]);
  const noteFills = (s: Partial<HighwayState>) => {
    const { ctx, fills } = recorder();
    drawHighway(ctx, L, chart, state({ noteState: hit, ...s }));
    return solid(fills, settings.noteColor).length;
  };

  it("feeds into its key while the key is held, and is consumed once it's let go or over", () => {
    expect(noteFills({ nowMs: 1000, pressed: new Set([60]) })).toBeGreaterThan(0);
    expect(noteFills({ nowMs: 1000 })).toBe(0);
    expect(noteFills({ nowMs: 2100, pressed: new Set([60]) })).toBe(0);
  });
});

describe("a note's glow near the line (key-polish)", () => {
  const blur = (nowMs: number) => {
    const { ctx, fills } = recorder();
    drawHighway(ctx, L, chart, state({ nowMs }));
    return Math.max(...solid(fills, settings.noteColor).map((f) => Number(f.split(" ")[1])));
  };

  it("is none until glowMs out, then grows to glowPx at the line", () => {
    expect(blur(-notePolish.glowMs - 100)).toBe(0);
    expect(blur(-notePolish.glowMs / 2)).toBeCloseTo(notePolish.glowPx / 2, 5);
    expect(blur(0)).toBe(notePolish.glowPx);
  });
});
