import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { handColor } from "../hand-colors";
import { fullRange, whiteIndex } from "../highway-zoom";
import { meterLayout } from "../fever-gauge";
import { drawHighway, isBlack, judgmentPlace, makeLayout, type HighwayState } from "./highway";
import { settings } from "./settings";

const chart = (pitches: number[]): Chart => ({
  id: "t",
  title: "t",
  composer: "t",
  source: "test",
  bpm: 100,
  beatsPerBar: 4,
  notes: pitches.map((pitch, i) => ({ id: String(i), pitch, beat: i, duration: 1, hand: "R" })),
});

describe("makeLayout", () => {
  it("pads C4–A4 to one extra white key each side: B3..B4", () => {
    const L = makeLayout(chart([60, 69]), 800, 600, 0);
    expect([L.lowPitch, L.highPitch]).toEqual([59, 71]);
  });

  it("pads black-key ends to whole white keys first: C#4–A#4 gives B3..C5", () => {
    const L = makeLayout(chart([61, 70]), 800, 600, 0);
    expect([L.lowPitch, L.highPitch]).toEqual([59, 72]);
    expect(isBlack(L.lowPitch) || isBlack(L.highPitch)).toBe(false);
  });

  it("lays keys left to right; black keys are narrower and straddle their neighbours", () => {
    const L = makeLayout(chart([60, 72]), 900, 600, 0);
    let prev = -Infinity;
    for (let p = L.lowPitch; p <= L.highPitch; p++) {
      const k = L.keyX(p);
      expect(k.x).toBeGreaterThan(prev);
      prev = k.x;
    }
    const white = L.keyX(60), black = L.keyX(61), next = L.keyX(62);
    expect(black.width).toBeLessThan(white.width);
    expect(black.x + black.width / 2).toBeCloseTo(next.x);
    expect(L.keyX(L.highPitch).x + L.keyX(L.highPitch).width).toBeCloseTo(900);
  });

  it("perspective keeps the judgment line aligned and narrows the top by (1 - p)", () => {
    const L = makeLayout(chart([60, 72]), 1000, 600, 0.3);
    const cx = 500;
    for (const x of [0, 137, 500, 1000]) {
      expect(L.project(x, L.judgmentLineY)).toBeCloseTo(x);
      expect(L.project(x, 0) - cx).toBeCloseTo((x - cx) * 0.7);
    }
    expect(makeLayout(chart([60]), 1000, 600, 0.9).perspective).toBe(0.3);
  });
});

describe("drawHighway backdrop", () => {
  // A 2D context that records the fill style of each fillRect and ignores everything else.
  const recorder = () => {
    const calls: string[] = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get: (t, k) =>
        k in t ? t[k] : k === "fillRect" ? () => calls.push(`fillRect ${String(t.fillStyle)}`) : k === "clearRect" ? () => calls.push("clearRect") : () => ({ width: 0, addColorStop() {} }),
      set: (t, k, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  };
  const state = (backdropAlpha?: number): HighwayState => ({ nowMs: 0, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null, backdropAlpha });

  it("is opaque black with no background layer, as before", () => {
    const c = chart([60, 72]);
    const { ctx, calls } = recorder();
    drawHighway(ctx, makeLayout(c, 800, 600, 0), c, state());
    expect(calls[0]).toBe("fillRect #000");
  });

  it("clears, then fills at the given alpha while a background layer is mounted", () => {
    const c = chart([60, 72]);
    const { ctx, calls } = recorder();
    drawHighway(ctx, makeLayout(c, 800, 600, 0), c, state(0.55));
    expect(calls.slice(0, 2)).toEqual(["clearRect", "fillRect rgba(0,0,0,0.55)"]);
  });
});

describe("drawHighway hand colors (hand-colors)", () => {
  // Records the fill style of every fill and fillRect.
  const recorder = () => {
    const fills: string[] = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get: (t, k) => (k in t ? t[k] : k === "fill" || k === "fillRect" ? () => fills.push(String(t.fillStyle)) : () => ({ width: 0, addColorStop() {} })), // measureText, gradients
      set: (t, k, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, fills };
  };
  const twoHands: Chart = { ...chart([60, 64]), notes: chart([60, 64]).notes.map((n, i) => ({ ...n, beat: 0.5, hand: i ? "L" : "R" })) };
  const draw = (c: Chart, s: Partial<HighwayState> = {}) => {
    const { ctx, fills } = recorder();
    drawHighway(ctx, makeLayout(c, 800, 600, 0), c, { nowMs: 0, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null, ...s });
    return fills;
  };

  it("a two-hand chart falls in both hands' colors; a one-hand chart in today's color only", () => {
    expect(draw(twoHands)).toEqual(expect.arrayContaining([handColor("R"), handColor("L")]));
    const oneHand = { ...twoHands, notes: twoHands.notes.map((n) => ({ ...n, hand: "L" as const })) };
    expect(draw(oneHand)).not.toContain(handColor("L"));
    expect(draw(oneHand)).toContain(settings.noteColor);
  });

  it("a key lights in the hand of the note it hit, and as before when it hit nothing", () => {
    const hit = draw(twoHands, { pressed: new Set([64]), pressedHand: new Map([[64, "L"]]) });
    expect(hit.filter((f) => f === handColor("L")).length).toBeGreaterThan(draw(twoHands).filter((f) => f === handColor("L")).length);
    const none = draw(twoHands, { pressed: new Set([62]), pressedHand: new Map() });
    expect(none).toContain(settings.keyLitColor);
    expect(none.filter((f) => f === handColor("L")).length).toBe(draw(twoHands).filter((f) => f === handColor("L")).length);
  });
});

describe("makeLayout with a view (highway-zoom)", () => {
  const wide = chart([40, 61, 88]);
  it("a view of the whole range lays every key exactly as without one", () => {
    const plain = makeLayout(wide, 1280, 720, 0);
    const viewed = makeLayout(wide, 1280, 720, 0, fullRange(wide));
    expect([viewed.lowPitch, viewed.highPitch, viewed.judgmentLineY]).toEqual([plain.lowPitch, plain.highPitch, plain.judgmentLineY]);
    for (let p = plain.lowPitch; p <= plain.highPitch; p++) {
      expect(viewed.keyX(p).x).toBeCloseTo(plain.keyX(p).x);
      expect(viewed.keyX(p).width).toBeCloseTo(plain.keyX(p).width);
    }
  });

  it("a narrower view widens the keys and keeps the judgment line where it was", () => {
    const plain = makeLayout(wide, 1280, 720, 0);
    const lo = whiteIndex(60);
    const zoomed = makeLayout(wide, 1280, 720, 0, { lo, hi: lo + 15 });
    expect(zoomed.keyX(60)).toEqual({ x: 0, width: 1280 / 15 });
    expect(zoomed.keyX(60).width).toBeGreaterThan(plain.keyX(60).width);
    expect(zoomed.judgmentLineY).toBe(plain.judgmentLineY);
    expect([zoomed.lowPitch, zoomed.highPitch]).toEqual([60, 84]);
  });
});

describe("the judgment word (#244)", () => {
  // The issue's bar: where notes are dim and seconds away, so well past juice-visual's 500 ms. A note at height y is
  // due in (line - y) / line × lookahead.
  it.each([
    [1280, 720],
    [1920, 1080],
    [1024, 768],
  ])("at %i×%i it sits under the HUD's band and ends more than 1 s above the line", (w, h) => {
    const L = makeLayout(chart([60, 69]), w, h, settings.perspective);
    const line = L.judgmentLineY;
    const p = judgmentPlace(w, line);
    const meter = meterLayout(w, line).bar;
    expect(p.cy - p.size / 2).toBeGreaterThanOrEqual(meter.y + meter.h);
    expect(((line - p.bottom) / line) * settings.lookaheadMs).toBeGreaterThan(1000);
  });
});
