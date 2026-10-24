import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import type { Chart, Frame } from "../../contracts";
import { settings } from "../core/settings";
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
  const ctx = { save() {}, restore() {}, beginPath() {}, roundRect() {}, fill: vi.fn(), fillText: vi.fn() } as unknown as CanvasRenderingContext2D;
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
