import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { Chart, Frame } from "../../contracts";
import { settings } from "../core/settings";
import { canvasFonts } from "../duo-tokens/canvas";
import { handColor, handColors, noteColorFor } from ".";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));

it("gives the two hands two different colors, right hand today's", () => {
  expect(handColor("L")).not.toBe(handColor("R"));
  expect(handColor("R")).toBe(settings.noteColor);
});

it("a one-hand chart keeps today's color on every note, a two-hand chart colors by hand", () => {
  const twinkle = song("twinkle");
  expect(new Set(twinkle.notes.map((n) => noteColorFor(twinkle)(n.hand)))).toEqual(new Set([settings.noteColor]));
  const leftOnly: Chart = { ...twinkle, notes: twinkle.notes.map((n) => ({ ...n, hand: "L" as const })) };
  expect(noteColorFor(leftOnly)("L")).toBe(settings.noteColor);
  const furElise = song("fur-elise");
  expect(noteColorFor(furElise)("L")).toBe(handColor("L"));
  expect(noteColorFor(furElise)("R")).toBe(handColor("R"));
});

it("the legend draws during the count-in for a two-hand chart only, and is gone by beat 1", () => {
  const ctx = { save() {}, restore() {}, beginPath() {}, fillRect() {}, fillText: vi.fn() } as unknown as CanvasRenderingContext2D;
  const frame = (nowMs: number) => ({ nowMs, width: 1280, height: 720, judgmentLineY: 600 }) as Frame;
  const draws = (chart: Chart, nowMs: number) => {
    vi.mocked(ctx.fillText).mockClear();
    const p = handColors();
    p.transformChart!(chart, new URLSearchParams());
    p.draw!(ctx, frame(nowMs));
    return vi.mocked(ctx.fillText).mock.calls.map((c) => c[0]);
  };
  expect(draws(song("fur-elise"), -2000)).toEqual(["L", "R"]);
  expect(draws(song("fur-elise"), 0)).toEqual([]);
  expect(draws(song("twinkle"), -2000)).toEqual([]);
});

it("the legend's chips are square, its letters in the kit's data face at 16 px on 720 high and 24 px on 1080 (#1135)", () => {
  const legend = (height: number) => {
    const fonts: string[] = [];
    const rects: number[][] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_, k) => (k === "fillRect" ? (...a: number[]) => rects.push(a) : k === "roundRect" ? () => rects.push([NaN]) : () => {}),
      set: (_, k, v) => (k === "font" && fonts.push(v), true),
    }) as unknown as CanvasRenderingContext2D;
    const p = handColors();
    p.transformChart!(song("fur-elise"), new URLSearchParams());
    p.draw!(ctx, { nowMs: -2000, width: 1920, height, judgmentLineY: height - 120 } as Frame);
    return { fonts, sizes: rects.map((r) => [r[2], r[3]]) };
  };
  expect(legend(720)).toEqual({ fonts: [canvasFonts.data(16)], sizes: [[28, 28], [28, 28]] });
  expect(legend(1080)).toEqual({ fonts: [canvasFonts.data(24)], sizes: [[42, 42], [42, 42]] });
});
