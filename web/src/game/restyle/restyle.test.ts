import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it, test } from "vitest";
import type { Chart, ChartNote } from "../../contracts";
import { lockProblems, melody, sourceIdFor } from ".";

// Synthetic charts only in the first block: no notes typed from a song.
const n = (id: string, pitch: number, beat: number, hand: "R" | "L" = "R", duration = 1): ChartNote => ({ id, pitch, beat, duration, hand });
const chart = (notes: ChartNote[], extra: Partial<Chart> = {}) =>
  ({ id: "s", title: "S", composer: "c", source: "synthetic", bpm: 100, beatsPerBar: 4, notes, ...extra }) as Chart;
const source = chart([n("a", 60, 0), n("l", 48, 0, "L"), n("b", 62, 1), n("c", 64, 2), n("d", 65, 3)]);
const restyle = (pitches: number[]) => chart(pitches.map((p, i) => n(`r${i + 1}`, p, i * 1.5, "R", 0.5)));

describe("the lock", () => {
  it("new beats, durations, bpm, meter and left hand pass", () => {
    const r = restyle([60, 62, 64, 65]);
    r.bpm = 140;
    r.beatsPerBar = 3;
    r.notes.push(n("l1", 41, 0, "L", 3), n("l2", 45, 0, "L", 3));
    expect(lockProblems(source, r)).toEqual([]);
  });
  it("one pitch changed fails, naming the note", () => {
    expect(lockProblems(source, restyle([60, 62, 63, 65]))).toEqual(["melody note 3: source c is 64, restyle r3 is 63"]);
  });
  it("an octave moved fails", () => {
    expect(lockProblems(source, restyle([60, 74, 64, 65]))).toEqual(["melody note 2: source b is 62, restyle r2 is 74"]);
  });
  it("a note dropped fails", () => {
    expect(lockProblems(source, restyle([60, 62, 64]))).toEqual(["melody note 4: source d is 65, restyle has none"]);
  });
  it("a note added fails", () => {
    expect(lockProblems(source, restyle([60, 62, 64, 65, 67]))).toEqual(["melody note 5: restyle r5 (67) is past the source's 4 notes"]);
  });
  it("two swapped fail", () => {
    expect(lockProblems(source, restyle([60, 64, 62, 65]))).toEqual(["melody note 2: source b is 62, restyle r2 is 64"]);
  });
  it("a right-hand chord fails, even with the melody on top", () => {
    const r = restyle([60, 62, 64, 65]);
    r.notes.push(n("x", 55, 0));
    expect(lockProblems(source, r)).toEqual(["right-hand chord at beat 0: r1 (60), x (55)"]);
  });
  it("a source's right-hand chord gives its top note", () => {
    const chordal = chart([n("a", 60, 0), n("a2", 55, 0), n("b", 62, 1)]);
    expect(melody(chordal).map((x) => x.pitch)).toEqual([60, 62]);
    expect(lockProblems(chordal, restyle([60, 62]))).toEqual([]);
  });
  it("the source is the longest library id that prefixes the restyle's", () => {
    expect(sourceIdFor("ode-to-joy-waltz", ["ode", "ode-to-joy", "twinkle"])).toBe("ode-to-joy");
    expect(sourceIdFor("nothing-trap", ["twinkle"])).toBeNull();
  });
});

// Every restyle present (local ones included) against its source. CI has none, so this block is empty there.
const root = new URL("../../../public/songs", import.meta.url).pathname;
const all = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((f) => f.split(sep).pop() === "chart.json")
  .map((f) => JSON.parse(readFileSync(join(root, f), "utf8")) as Chart);
const restyles = all.filter((c) => c.catalog?.startsWith("restyled from"));

test.each(restyles.map((c) => ({ id: c.id, c })))("$id keeps its source's melody", ({ c }) => {
  const id = sourceIdFor(c.id, all.filter((x) => x !== c).map((x) => x.id));
  expect(id, `no source chart for "${c.id}"`).not.toBeNull();
  expect(lockProblems(all.find((x) => x.id === id)!, c)).toEqual([]);
});
