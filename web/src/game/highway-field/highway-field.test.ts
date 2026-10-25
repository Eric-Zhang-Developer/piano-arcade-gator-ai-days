import { describe, expect, it } from "vitest";
import { barLineSettings } from "../bar-lines";
import type { Layout } from "../core/highway";
import { settings } from "../core/settings";
import { handColorSettings } from "../hand-colors";
import { pillSettings } from "../note-pills";
import { stageSettings } from "../stage";
import {
  barAlpha,
  calmLimit,
  depth,
  downbeat,
  drawField,
  feverHeat,
  fieldSettings,
  horizon,
  lineAlpha,
  luma,
  noise,
  onFieldEvent,
  snap,
  spill,
  type FieldCache,
} from ".";

const s = fieldSettings;
const LINE = 600;

describe("the calm rule: no layer's brightest pixel is brighter than the dimmest note", () => {
  const D = calmLimit();
  it("the ceiling is the far brightness × the dimmest note color (about 0.19)", () => {
    const colors = [...Object.values(handColorSettings.colors), settings.noteColor];
    expect(D).toBeCloseTo(pillSettings.farBrightness * Math.min(...colors.map(luma)), 6);
    expect(D).toBeGreaterThan(0.18);
    expect(D).toBeLessThan(0.2);
  });
  it("lines, at rest and on the downbeat, at every height", () => {
    for (let y = 0; y <= LINE; y += 25) {
      expect(barAlpha(y, LINE, 1)).toBeLessThanOrEqual(D);
      for (const k of ["bar", "octave", "seam"] as const) expect(lineAlpha(k, y, LINE)).toBeLessThanOrEqual(D);
    }
  });
  it("the haze, calm and fever, with its dither on top", () => {
    expect(s.horizonLuma + s.dither / 2).toBeLessThanOrEqual(D);
    expect(s.feverLuma + s.dither / 2).toBeLessThanOrEqual(D);
  });
  it("the spill at its brightest, in the brightest light a key can have (white, a key that hit nothing)", () => {
    const lights = [...Object.values(handColorSettings.colors), settings.keyLitColor];
    expect(s.spillAlpha * Math.max(...lights.map(luma))).toBeLessThanOrEqual(D);
  });
});

it("fever's tint is fever-stage's star color", () => {
  expect(s.feverColor).toBe(stageSettings.star);
  expect(s.feverEaseMs).toBe(stageSettings.feverEaseMs);
});

it("the hierarchy: bar > octave > seam in alpha, at every height", () => {
  for (let y = 0; y <= LINE; y += 25) {
    expect(lineAlpha("bar", y, LINE)).toBeGreaterThan(lineAlpha("octave", y, LINE));
    expect(lineAlpha("octave", y, LINE)).toBeGreaterThan(lineAlpha("seam", y, LINE));
  }
});

it("lines fade toward the top exactly as the notes do: far brightness at the top, full at the line", () => {
  expect(depth(0, LINE)).toBeCloseTo(pillSettings.farBrightness, 6);
  expect(depth(LINE, LINE)).toBe(1);
  expect(lineAlpha("bar", LINE, LINE)).toBe(barLineSettings.lineAlpha);
  expect(lineAlpha("octave", 0, LINE)).toBeCloseTo(s.octaveAlpha * pillSettings.farBrightness, 6);
});

describe("the downbeat", () => {
  it("rises over the 120 ms before a bar reaches the line, and is gone outside them", () => {
    expect(s.downbeatMs).toBe(120);
    expect(downbeat(1000, 1000 - 121, false)).toBe(0);
    expect(downbeat(1000, 1000 - 60, false)).toBeCloseTo(0.5, 6);
    expect(downbeat(1000, 1000, false)).toBe(1);
    expect(downbeat(1000, 1001, false)).toBe(0);
    expect(barAlpha(LINE, LINE, 1)).toBe(s.downbeatAlpha);
    expect(barAlpha(LINE, LINE, 1)).toBeGreaterThan(barAlpha(LINE, LINE, 0));
  });
  it("is absent under reduced motion", () => {
    for (const d of [0, 30, 60, 119]) expect(downbeat(1000, 1000 - d, true)).toBe(0);
  });
});

it("the spill: full at the line, fading to nothing by 40 px", () => {
  expect(s.spillPx).toBe(40);
  expect(spill(0)).toBe(1);
  expect(spill(20)).toBeGreaterThan(0);
  expect(spill(20)).toBeLessThan(spill(10));
  expect(spill(40)).toBe(0);
  expect(spill(60)).toBe(0);
});

it("the haze: brightest at the top, gone by its height", () => {
  expect(horizon(0, LINE, 1)).toBe(1);
  expect(horizon(LINE * s.horizonHeight * 0.5, LINE, 1)).toBeCloseTo(0.25, 6);
  expect(horizon(LINE * s.horizonHeight, LINE, 1)).toBe(0);
});

it("the dither's noise covers 0 … 1 with a mean near a half", () => {
  let sum = 0;
  let lo = 1;
  let hi = 0;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const n = noise(x, y);
      sum += n;
      lo = Math.min(lo, n);
      hi = Math.max(hi, n);
    }
  expect(sum / 4096).toBeCloseTo(0.5, 1);
  expect(lo).toBeLessThan(0.02);
  expect(hi).toBeGreaterThan(0.98);
});

it("a hairline is 1 device pixel, centered on one", () => {
  expect(snap(450.3, 1)).toBe(450.5);
  expect(snap(450.3, 1.5)).toBeCloseTo(675.5 / 1.5, 9);
  expect(snap(450.3, 2)).toBe(450.25);
});

describe("fever", () => {
  it("eases in over 400 ms from feverStart and out from feverEnd; a new song starts cold", () => {
    onFieldEvent({ type: "songStart", atMs: 0 });
    expect(feverHeat(1000, false)).toBe(0);
    onFieldEvent({ type: "feverStart", atMs: 1000 });
    expect(feverHeat(1200, false)).toBeCloseTo(0.5, 6);
    expect(feverHeat(1500, false)).toBe(1);
    onFieldEvent({ type: "feverEnd", atMs: 2000 });
    expect(feverHeat(2100, false)).toBeCloseTo(0.75, 6);
    onFieldEvent({ type: "feverStart", atMs: 3000 });
    expect(feverHeat(3100, true)).toBe(1); // reduced motion: at once
    onFieldEvent({ type: "songStart", atMs: 0 });
    expect(feverHeat(3100, false)).toBe(0);
  });
});

describe("drawField", () => {
  // A recording 2D context: any method is recorded, any property kept.
  const record = () => {
    const calls: string[] = [];
    const ctx = new Proxy({} as Record<string | symbol, unknown>, {
      get: (t, k) =>
        k in t
          ? t[k]
          : k === "createImageData"
            ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })
            : k === "createLinearGradient"
              ? () => ({ addColorStop: () => {} })
              : (...a: unknown[]) => (calls.push(`${String(k)} ${a.map((v) => (typeof v === "object" ? "_" : v)).join(",")}`), undefined),
      set: (t, k, v) => ((t[k] = v), true),
    });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
  };
  const cache = (): FieldCache => ({ baked: null, bakes: 0, make: (w, h) => ({ width: w, height: h, getContext: () => record().ctx }) as unknown as OffscreenCanvas });
  const layout = (width = 1000): Layout =>
    ({
      width,
      height: 720,
      judgmentLineY: LINE,
      perspective: 0,
      lowPitch: 48,
      highPitch: 72,
      isBlack: () => false,
      keyX: (p: number) => ({ x: (p - 48) * 10, width: 10 }),
      project: (x: number) => x,
    }) as unknown as Layout;
  const state = { nowMs: 0, lights: [] };

  it("bakes once per layout, not per frame", () => {
    const c = cache();
    const L = layout();
    for (let i = 0; i < 5; i++) drawField(record().ctx, L, { ...state, nowMs: i * 16 }, c);
    expect(c.bakes).toBe(1);
    drawField(record().ctx, layout(1200), state, c);
    expect(c.bakes).toBe(2);
  });

  it("strokes only the bar lines on the highway, each a hairline on a pixel center", () => {
    const { ctx, calls } = record();
    const lines = [
      { atMs: -100, label: 1 }, // past the line: over the keys
      { atMs: 500, label: 2 },
      { atMs: 1500, label: null },
      { atMs: 2500, label: 4 }, // past the top
    ];
    drawField(ctx, layout(), { ...state, barLines: lines }, cache());
    expect(calls.filter((c) => c === "stroke ")).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith("moveTo"))).toEqual(["moveTo 0,450.5", "moveTo 0,150.5"]);
    expect(calls.filter((c) => c.startsWith("fillText"))).toEqual(["fillText 2,6,448.5"]);
  });

  it("a held key's spill fills its own lane, 40 px up from the line; a light that has faded draws none", () => {
    const { ctx, calls } = record();
    drawField(ctx, layout(), { ...state, lights: [{ pitch: 60, color: "#2b9bff", strength: 1 }, { pitch: 64, color: "#ffffff", strength: 0 }] }, cache());
    expect(calls.filter((c) => c.startsWith("fillRect")).slice(1)).toEqual(["fillRect 120,560,10,40"]);
  });
});
