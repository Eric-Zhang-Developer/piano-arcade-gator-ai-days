import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { barLines } from "../bar-lines";
import { lastBar } from "../song-preview/opening";
import { barReadout } from "./bar";

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

// The clusters' corner brackets are the Duo kit's (spec: duo-hud, Validation 1): this folder keeps no bracket code.
describe("brackets come from the kit", () => {
  it("duo-hud has no bracket drawer of its own", () => {
    const dir = join(__dirname);
    const local = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.endsWith(".test.ts"));
    for (const f of local) expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/function drawBrackets|lineTo\(/);
  });
});
