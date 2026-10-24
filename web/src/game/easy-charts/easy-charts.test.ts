import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, ChartNote, Hand } from "../../contracts";
import { keyMap } from "../core/input";
import { difficulty } from "../difficulty/difficulty";
import { easyChart, easyCharts, withLevel } from ".";

const songsDir = new URL("../../../public/songs/", import.meta.url);
const ids = readdirSync(songsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "local")
  .map((d) => d.name);
const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`${id}/chart.json`, songsDir), "utf8"));
const chart = (bpm: number, notes: [number, number, Hand?][]): Chart => ({
  id: "t",
  title: "t",
  composer: "t",
  source: "t",
  bpm,
  beatsPerBar: 4,
  notes: notes.map(([pitch, beat, hand = "R"], i) => ({ id: `n${i}`, pitch, beat, duration: 0.25, hand })),
});
const ms = (c: Chart, n: ChartNote) => (n.beat * 60000) / c.bpm;

describe("easyChart on every song", () => {
  it.each(ids)("%s: original notes, gaps of 250 ms or more, no harder than Normal", (id) => {
    const normal = song(id);
    const easy = easyChart(normal);
    for (const n of easy.notes) expect(normal.notes).toContainEqual(n);
    const byTime = [...easy.notes].sort((a, b) => a.beat - b.beat);
    for (let i = 1; i < byTime.length; i++) expect(ms(easy, byTime[i]) - ms(easy, byTime[i - 1])).toBeGreaterThanOrEqual(250 - 1e-6);
    const seen = new Set(easy.notes.map((n) => `${n.hand}@${n.beat}`));
    expect(seen.size).toBe(easy.notes.length); // no hand has two notes on one beat
    expect(easy.notes.length).toBeGreaterThan(0);
    expect(easy.notes.length).toBeLessThanOrEqual(normal.notes.length);
    expect(difficulty(easy).level).toBeLessThanOrEqual(difficulty(normal).level);
    if (new Set(easy.notes.map((n) => n.hand)).size === 2) {
      const laptop = new Set(keyMap(Math.min(...easy.notes.map((n) => n.pitch))).values());
      for (const n of easy.notes) expect(laptop.has(n.pitch)).toBe(true);
    }
    process.stdout.write(`${id}: Normal ${normal.notes.length} notes Lv ${difficulty(normal).level}, Easy ${easy.notes.length} notes Lv ${difficulty(easy).level}\n`); // the spec asks for the counts
  });

  it("leaves Twinkle as it is, and puts Chopin's Prelude on the laptop keys", () => {
    expect(easyChart(song("twinkle"))).toEqual(song("twinkle"));
    const chopin = easyChart(song("chopin-prelude-4"));
    const laptop = new Set(keyMap(Math.min(...chopin.notes.map((n) => n.pitch))).values());
    for (const n of chopin.notes) expect(laptop.has(n.pitch)).toBe(true);
  });
});

describe("easyChart's three steps", () => {
  it("keeps the top note of a chord: C-E-G on one beat keeps G", () => {
    expect(easyChart(chart(60, [[60, 0], [64, 0], [67, 0]])).notes.map((n) => n.pitch)).toEqual([67]);
  });

  it("thins runs: eight 16ths at 120 bpm keep four, every other one", () => {
    const easy = easyChart(chart(120, Array.from({ length: 8 }, (_, i) => [60 + (i % 3), i / 4] as [number, number])));
    expect(easy.notes.map((n) => n.beat)).toEqual([0, 0.5, 1, 1.5]);
  });

  it("keeps only the right hand when both hands don't fit the laptop keys", () => {
    const easy = easyChart(chart(60, [[36, 0, "L"], [84, 1, "R"], [40, 2, "L"], [86, 3, "R"]]));
    expect(easy.notes.map((n) => n.hand)).toEqual(["R", "R"]);
  });

  it("keeps the left hand when there's no right hand", () => {
    expect(easyChart(chart(60, [[36, 0, "L"], [40, 1, "L"]])).notes).toHaveLength(2);
  });
});

describe("the plugin and the level in URLs", () => {
  it("plays the Easy chart only with level=easy", () => {
    const p = easyCharts();
    const c = song("chopin-prelude-4");
    expect(p.transformChart!(c, new URLSearchParams("level=easy")).notes.length).toBeLessThan(c.notes.length);
    expect(p.transformChart!(c, new URLSearchParams("level=hard"))).toBe(c);
    expect(p.transformChart!(c, new URLSearchParams())).toBe(c);
  });

  it("withLevel adds or removes level=easy and keeps the rest", () => {
    expect(withLevel("/play?song=fur-elise", "easy")).toBe("/play?song=fur-elise&level=easy");
    expect(withLevel("/play?song=fur-elise&level=easy", "normal")).toBe("/play?song=fur-elise");
    expect(withLevel("/play?song=x&hands=R&mode=wait", "easy")).toBe("/play?song=x&hands=R&mode=wait&level=easy");
    expect(withLevel("/play", "normal")).toBe("/play");
  });
});
