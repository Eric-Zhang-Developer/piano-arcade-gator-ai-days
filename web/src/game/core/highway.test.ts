import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { blackKeyLaneSettings } from "../black-key-lanes";
import { handColor } from "../hand-colors";
import { splitHands } from "../hand-mode/hands";
import { whiteIndex } from "../highway-zoom";
import { meterLayout } from "../fever-gauge";
import { readFileSync } from "node:fs";
import { drawHighway, isBlack, judgmentPlace, makeLayout, staticRange, type HighwayState } from "./highway";
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

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));

describe("the static keyboard (#384): one range per song, C to C", () => {
  it("snaps to the C at or below the lowest note and the C at or above the highest", () => {
    expect(staticRange(song("fur-elise"))).toEqual({ lowPitch: 36, highPitch: 96 }); // E2–E6 -> C2–C7
    expect(staticRange(song("moonlight-3"))).toEqual({ lowPitch: 24, highPitch: 96 }); // A1–C#6 -> C1–C7
    expect(staticRange(song("nocturne-op9-2"))).toEqual({ lowPitch: 24, highPitch: 96 }); // A#1–D6 -> C1–C7
    expect(staticRange(chart([50, 96]))).toEqual({ lowPitch: 48, highPitch: 96 }); // a top C ends the range on it
    expect(staticRange(chart([37, 94]))).toEqual({ lowPitch: 36, highPitch: 96 }); // black ends snap to Cs too
  });

  it("a chart inside C2–C6 gets C2–C6: four octaves, the same keyboard for most songs", () => {
    expect(staticRange(song("twinkle"))).toEqual({ lowPitch: 36, highPitch: 84 }); // C4–A4, inside C2–C6
    expect(staticRange(song("minuet-g"))).toEqual({ lowPitch: 36, highPitch: 84 }); // F#4–G5, inside C2–C6
    expect(staticRange(song("ode-to-joy"))).toEqual({ lowPitch: 36, highPitch: 84 }); // G2–D5
    expect(staticRange(chart([60]))).toEqual({ lowPitch: 36, highPitch: 84 });
    expect(staticRange(chart([36, 84]))).toEqual({ lowPitch: 36, highPitch: 84 });
  });

  it("outside C2–C6, under four octaves: the missing ones split with the odd one above", () => {
    expect(staticRange(chart([72, 90]))).toEqual({ lowPitch: 60, highPitch: 108 }); // C5–C7 is 24: one below, one above
    expect(staticRange(chart([61, 94]))).toEqual({ lowPitch: 60, highPitch: 108 }); // C4–C7 is 36: the odd one above
  });

  it("keeps to the piano's 21–108 and still four octaves wide", () => {
    expect(staticRange(chart([21, 108]))).toEqual({ lowPitch: 21, highPitch: 108 });
    expect(staticRange(chart([100, 105]))).toEqual({ lowPitch: 60, highPitch: 108 }); // no room above: all go below
    expect(staticRange(chart([108]))).toEqual({ lowPitch: 60, highPitch: 108 });
    expect(staticRange(chart([21, 30]))).toEqual({ lowPitch: 21, highPitch: 72 }); // A0–C3 is 15: three octaves above
    for (const c of [chart([21]), chart([22, 23]), chart([107, 108])]) {
      const r = staticRange(c);
      expect(r.lowPitch).toBeGreaterThanOrEqual(21);
      expect(r.highPitch).toBeLessThanOrEqual(108);
      expect(r.highPitch - r.lowPitch).toBeGreaterThanOrEqual(48);
    }
  });

  it("a hands=R take keeps the whole song's keyboard: Für Elise stays C2–C7", () => {
    const full = song("fur-elise");
    const right = splitHands(full, "R").judged;
    expect(staticRange(right)).not.toEqual(staticRange(full)); // why /play keeps the loaded chart's range
    const L = makeLayout(right, 1920, 1080, 0, undefined, staticRange(full));
    expect([L.lowPitch, L.highPitch]).toEqual([36, 96]);
  });

  it("makeLayout lays exactly that range, white keys at both ends", () => {
    for (const id of ["twinkle", "fur-elise", "maple-leaf-rag"]) {
      const c = song(id);
      const L = makeLayout(c, 1920, 1080, 0);
      expect({ lowPitch: L.lowPitch, highPitch: L.highPitch }).toEqual(staticRange(c));
      expect(L.keyX(L.lowPitch).x).toBeCloseTo(0);
      expect(L.keyX(L.highPitch).x + L.keyX(L.highPitch).width).toBeCloseTo(1920);
    }
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

describe("drawHighway black-key lanes (black-key-lanes)", () => {
  it("draws no lane shading at the default tint 0: the backdrop, then the first note", () => {
    const fills: string[] = [];
    const state: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(state, {
      get: (t, k) => (k in t ? t[k] : k === "fill" || k === "fillRect" ? () => fills.push(String(t.fillStyle)) : () => ({ width: 0, addColorStop() {} })),
      set: (t, k, v) => ((t[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const c = chart([60, 72]); // C4–C5
    const L = makeLayout(c, 800, 600, 0.2);
    drawHighway(ctx, L, c, { nowMs: 0, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null });
    expect(blackKeyLaneSettings.tint).toBe(0);
    expect(fills.slice(0, 2)).toEqual(["#000", settings.noteColor]); // nothing between the backdrop and the first note
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
    const viewed = makeLayout(wide, 1280, 720, 0, { lo: whiteIndex(plain.lowPitch), hi: whiteIndex(plain.highPitch) + 1 });
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

describe("keys outside the chart's range", () => {
  it("lie off-screen at finite positions, and every key in range is where it was", () => {
    const L = makeLayout(chart([60, 69]), 800, 600, 0);
    const w = L.keyX(60).width;
    expect(L.keyX(35)).toEqual({ x: -w, width: w }); // B1, one white below the range's lowest key (C2)
    expect(L.keyX(30).x).toBeLessThan(0);
    expect(Number.isFinite(L.keyX(30).x) && Number.isFinite(L.keyX(108).x) && Number.isFinite(L.keyX(54).x)).toBe(true);
    expect(L.keyX(86).x).toBeGreaterThanOrEqual(800); // D6, past the range's top (C6)
    for (let p = L.lowPitch, i = 0; p <= L.highPitch; p++) if (!isBlack(p)) expect(L.keyX(p).x).toBeCloseTo(i++ * w);
  });

  it("a pressed key below the range draws without throwing", () => {
    const L = makeLayout(chart([60, 69]), 800, 600, 0);
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (o, k) =>
        k in o
          ? o[k]
          : k === "createRadialGradient" || k === "createLinearGradient"
            ? (...a: number[]) => {
                if (!a.every(Number.isFinite)) throw new TypeError("non-finite");
                return { addColorStop: () => {} };
              }
            : () => ({ width: 0 }),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const s: HighwayState = { nowMs: 0, noteState: new Map(), pressed: new Set([30, 60]), latest: null, countInBeat: null };
    expect(() => drawHighway(ctx, L, chart([60, 69]), s)).not.toThrow();
  });
});

describe("drawHighway bar lines (bar-lines)", () => {
  // Records strokes and fills with their style, so the order of octave lines, bar lines and notes shows.
  const recorder = () => {
    const calls: string[] = [];
    const t: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(t, {
      get: (o, k) =>
        k in o
          ? o[k]
          : k === "stroke"
            ? () => calls.push(`stroke ${String(o.strokeStyle)}`)
            : k === "fill"
              ? () => calls.push(`fill ${String(o.fillStyle)}`)
              : () => ({ width: 0, addColorStop() {} }),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, calls };
  };
  const c = chart([60, 72]); // C4 and C5: octave lines at both
  const draw = (barLines?: { atMs: number; label: number | null }[]) => {
    const { ctx, calls } = recorder();
    drawHighway(ctx, makeLayout(c, 800, 600, 0), c, { nowMs: 0, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null, barLines });
    return calls;
  };

  it("strokes the bar lines after the octave lines and before the first note's fill", () => {
    const calls = draw([{ atMs: 0, label: 1 }, { atMs: 600, label: 2 }]);
    const octave = calls.lastIndexOf("stroke rgba(255,255,255,0.08)");
    const bars = calls.flatMap((x, i) => (x === "stroke rgba(255,255,255,0.12)" ? [i] : []));
    const note = calls.findIndex((x) => x.startsWith("fill") && x !== `fill rgba(255,255,255,${blackKeyLaneSettings.tint})`); // black-key lanes fill first
    expect(bars).toHaveLength(2);
    expect(octave).toBeLessThan(bars[0]);
    expect(bars[1]).toBeLessThan(note);
  });

  it("without a list, nothing changes: no bar-line strokes, the same calls as an empty list", () => {
    expect(draw().some((x) => x.includes("0.12"))).toBe(false);
    expect(draw()).toEqual(draw([]));
  });
});
