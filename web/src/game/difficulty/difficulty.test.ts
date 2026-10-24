import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { difficulty } from "./difficulty";

const songsDir = new URL("../../../public/songs/", import.meta.url);
const charts = new Map<string, Chart>(
  readdirSync(songsDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.split(sep).pop() === "chart.json")
    .map((f) => [f.split(sep).slice(0, -1).join("/"), JSON.parse(readFileSync(new URL(f, songsDir), "utf8"))]),
);
const level = (id: string) => difficulty(charts.get(id)!).level;
const twinkle = charts.get("twinkle")!;

// The rungs song-pack-1 and song-pack-2 name, easiest first. Clair de lune ("Medium-hard") is left out: its
// 79-note excerpt is easier than Für Elise and Gymnopédie on every input but one, so the formula wins (spec's Defaults).
const RUNGS = [["ode-to-joy"], ["chopin-prelude-4"], ["fur-elise", "gymnopedie-1"], ["nocturne-op9-2", "maple-leaf-rag"], ["moonlight-3"]];

describe("difficulty", () => {
  it("gives every chart under public/songs an integer from 1 to 15", () => {
    expect(charts.size).toBeGreaterThan(0);
    for (const [id, c] of charts) {
      const { level } = difficulty(c);
      expect(Number.isInteger(level) && level >= 1 && level <= 15, `${id}: ${level}`).toBe(true);
    }
  });

  it("puts Twinkle lowest in the library", () => {
    for (const id of charts.keys()) if (id !== "twinkle") expect(level(id), id).toBeGreaterThan(level("twinkle"));
  });

  it("keeps the named rungs in order", () => {
    for (let i = 1; i < RUNGS.length; i++) {
      const below = Math.max(...RUNGS[i - 1].filter((id) => charts.has(id)).map(level));
      for (const id of RUNGS[i].filter((id) => charts.has(id))) expect(level(id), id).toBeGreaterThan(below);
    }
  });

  it("scores a chart higher at double speed", () => {
    const fast = { ...twinkle, notes: twinkle.notes.map((n) => ({ ...n, beat: n.beat / 2 })) };
    expect(difficulty(fast).level).toBeGreaterThan(difficulty(twinkle).level);
  });

  it("scores a chart higher with left-hand chords added", () => {
    const chords = twinkle.notes.filter((n) => n.beat % 4 === 0).flatMap((n) => [
      { id: `${n.id}-l1`, pitch: 48, beat: n.beat, duration: 2, hand: "L" as const },
      { id: `${n.id}-l2`, pitch: 55, beat: n.beat, duration: 2, hand: "L" as const },
    ]);
    const harder = { ...twinkle, notes: [...twinkle.notes, ...chords] };
    expect(difficulty(harder).inputs.chordShare).toBeGreaterThan(0);
    expect(difficulty(harder).level).toBeGreaterThan(difficulty(twinkle).level);
  });
});
