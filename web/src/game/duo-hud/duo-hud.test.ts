import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { barLines } from "../bar-lines";
import { lastBar } from "../song-preview/opening";
import { barReadout } from "./bar";
import { drawBrackets } from "./brackets";

const song = (id: string) => JSON.parse(readFileSync(join(__dirname, "../../../public/songs", id, "chart.json"), "utf8")) as Chart;

describe("BAR n / N", () => {
  it.each(["twinkle", "fur-elise"])("on %s: matches bar-lines' bar starts, first, middle and last", (id) => {
    const chart = song(id);
    const lines = barLines(chart, new URLSearchParams());
    const N = lastBar(chart);
    expect(barReadout(lines, -2000)).toEqual({ n: 1, N }); // the count-in
    expect(barReadout(lines, lines[0].atMs)).toEqual({ n: 1, N });
    const mid = Math.floor(lines.length / 2);
    expect(barReadout(lines, lines[mid].atMs - 1)).toEqual({ n: mid, N });
    expect(barReadout(lines, lines[mid].atMs)).toEqual({ n: mid + 1, N });
    expect(barReadout(lines, lines.at(-1)!.atMs + 1)).toEqual({ n: N, N });
  });

  it("a bar loop reads the song's numbers, and its empty bar keeps the bar before it", () => {
    const lines = [5, 6, null, 5, 6].map((label, i) => ({ atMs: i * 1000, label }));
    expect([0, 1500, 2500, 3000, 4500].map((t) => barReadout(lines, t))).toEqual([5, 6, 6, 5, 6].map((n) => ({ n, N: 6 })));
  });
});

describe("drawBrackets", () => {
  // A fake context that records every path point.
  function record() {
    const pts: { op: string; x: number; y: number }[] = [];
    const t: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(t, {
      get: (o, k) => (k in o ? o[k] : k === "moveTo" || k === "lineTo" ? (x: number, y: number) => pts.push({ op: k, x, y }) : () => {}),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, pts };
  }

  it.each([
    [10, 20, 300, 64, 1],
    [0, 0, 40, 30, 2],
  ])("draws four corners inside its box (%i, %i, %i×%i, %ipx)", (x, y, w, h, lineWidth) => {
    const { ctx, pts } = record();
    drawBrackets(ctx, x, y, w, h, { color: "#fff", lineWidth });
    expect(pts.filter((p) => p.op === "moveTo")).toHaveLength(4);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(x + lineWidth / 2);
      expect(p.x).toBeLessThanOrEqual(x + w - lineWidth / 2);
      expect(p.y).toBeGreaterThanOrEqual(y + lineWidth / 2);
      expect(p.y).toBeLessThanOrEqual(y + h - lineWidth / 2);
    }
    // Each corner's vertex is a box corner (inset by half the stroke).
    const corners = pts.filter((_, i) => i % 3 === 1).map((p) => `${p.x},${p.y}`);
    const [l, t, r, b] = [x + lineWidth / 2, y + lineWidth / 2, x + w - lineWidth / 2, y + h - lineWidth / 2];
    expect(corners.sort()).toEqual([`${l},${t}`, `${r},${t}`, `${r},${b}`, `${l},${b}`].sort());
  });
});
