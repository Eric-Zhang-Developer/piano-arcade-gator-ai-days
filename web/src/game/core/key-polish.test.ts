import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, Judgment } from "../../contracts";
import { drawHighway, makeLayout, notePolish, type HighwayState } from "./highway";
import { settings } from "./settings";
import { SpriteCache, css, rgb } from "../note-material";

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
    return solid(fills, css(rgb(settings.noteColor))).length; // note-material fills the body as rgba(), the same color
  };

  it("feeds into its key while the key is held, and is consumed once it's let go or over", () => {
    expect(noteFills({ nowMs: 1000, pressed: new Set([60]) })).toBeGreaterThan(0);
    expect(noteFills({ nowMs: 1000 })).toBe(0);
    expect(noteFills({ nowMs: 2100, pressed: new Set([60]) })).toBe(0);
  });
});

describe("a note's glow near the line (key-polish)", () => {
  // note-material draws the glow as a pre-blurred sprite under the body, at an alpha that grows toward the line, in
  // place of a per-note shadowBlur. node has no canvas, so a stub surface stands in for the sprite.
  const get = SpriteCache.prototype.get; // the real one, taken before any spy wraps it
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  // Every property, call and write accepted: other layers build their own offscreen caches through the same stub.
  const anything: unknown = new Proxy(function () {}, { get: () => anything, apply: () => anything, set: () => true });
  const bloom = (nowMs: number) => {
    vi.stubGlobal("OffscreenCanvas", class {
      constructor(public width: number, public height: number) {}
      getContext = () => anything; // a sprite that draws nothing: only its draw onto the highway is counted
    });
    // only the bloom's own sprites count: other layers draw offscreen caches too
    const sprites = new Set<unknown>();
    vi.spyOn(SpriteCache.prototype, "get").mockImplementation(function (this: SpriteCache, ...a) {
      const made = get.apply(this, a);
      sprites.add(made);
      return made;
    });
    const alphas: number[] = [];
    const t: Record<string | symbol, unknown> = { globalAlpha: 1 };
    const ctx = new Proxy(t, {
      get: (o, k) => (k in o ? o[k] : k === "drawImage" ? (img: unknown) => sprites.has(img) && alphas.push(Number(o.globalAlpha)) : () => ({ width: 0, addColorStop() {} })),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    drawHighway(ctx, L, chart, state({ nowMs }));
    return Math.max(0, ...alphas);
  };

  it("is none until glowMs out, then grows to full at the line", () => {
    expect(bloom(-notePolish.glowMs - 100)).toBe(0);
    expect(bloom(-notePolish.glowMs / 2)).toBeCloseTo(bloom(0) / 2, 5);
    expect(bloom(0)).toBeCloseTo(0.9, 5); // the sprite's full alpha (note-material)
  });
});
