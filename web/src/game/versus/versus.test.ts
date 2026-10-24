import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { accuracy, emptyTally, reduceTallies, versusChart, winner } from "./split";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const range = (c: Chart, who: string) => {
  const p = c.notes.filter((n) => n.id.startsWith(`${who}:`)).map((n) => n.pitch);
  return [Math.min(...p), Math.max(...p)];
};
const part = (pitches: number[]): Chart => ({
  id: "t",
  title: "t",
  composer: "test",
  source: "test",
  bpm: 60,
  beatsPerBar: 4,
  notes: pitches.map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" as const })),
});

describe("versusChart", () => {
  it("Twinkle (60–69): P1 at 60–69, P2 an octave down at 48–57, ids prefixed", () => {
    const twinkle = song("twinkle");
    const v = versusChart(twinkle)!;
    expect(range(v, "p1")).toEqual([60, 69]);
    expect(range(v, "p2")).toEqual([48, 57]);
    expect(v.notes).toHaveLength(2 * twinkle.notes.length);
    expect(v.notes[0].id).toBe(`p1:${twinkle.notes[0].id}`);
  });

  it("the Minuet (66–79) lands two octaves apart", () => {
    const v = versusChart(song("minuet-g"))!;
    expect(range(v, "p1")).toEqual([66, 79]);
    expect(range(v, "p2")).toEqual([42, 55]);
  });

  it("a part 15 semitones wide lands two octaves apart", () => {
    const v = versusChart(part([62, 77]))!;
    expect(range(v, "p1")).toEqual([62, 77]);
    expect(range(v, "p2")).toEqual([38, 53]);
  });

  it("moves a low part up to middle C", () => {
    expect(range(versusChart(part([40, 45]))!, "p1")).toEqual([64, 69]);
  });

  it("refuses a part spanning 30–100", () => {
    expect(versusChart(part([30, 100]))).toBeNull();
  });

  it("takes only the right hand of a two-hand chart", () => {
    const c: Chart = { ...part([64, 67]), notes: [...part([64, 67]).notes, { id: "l", pitch: 40, beat: 0, duration: 1, hand: "L" }] };
    expect(versusChart(c)!.notes.map((n) => n.id)).toEqual(["p1:n0", "p1:n1", "p2:n0", "p2:n1"]);
  });
});

describe("tallies", () => {
  const hit = (noteId: string): GameEvent => ({ type: "noteHit", noteId, pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: 0 });
  const miss = (noteId: string): GameEvent => ({ type: "noteMiss", noteId, pitch: 48, atMs: 0 });
  const run = (events: GameEvent[]) => events.reduce(reduceTallies, { p1: emptyTally(), p2: emptyTally() });

  it("P1 hits everything, P2 misses half: P1 100%, P2 50%, P1 WINS", () => {
    const t = run(["a", "b", "c", "d"].flatMap((id, i) => [hit(`p1:${id}`), i % 2 ? miss(`p2:${id}`) : hit(`p2:${id}`)]));
    expect(accuracy(t.p1)).toBe(1);
    expect(accuracy(t.p2)).toBe(0.5);
    expect(winner(t)).toBe("P1 WINS");
  });

  it("an extra at pitch 50 counts against P2; a WRONG note there breaks P2's combo and accuracy", () => {
    let t = run([hit("p2:a"), { type: "extra", pitch: 50, atMs: 0 }]);
    expect([t.p2.extra, t.p1.extra]).toEqual([1, 0]);
    t = run([hit("p2:a"), { type: "extra", pitch: 50, atMs: 0 }, { type: "wrongNote", pitch: 50, atMs: 0 }]);
    expect([t.p2.wrong, t.p2.combo, accuracy(t.p2)]).toEqual([1, 0, 0.5]);
  });

  it("a DRAW when the accuracies match to 0.1%", () => {
    expect(winner(run([hit("p1:a"), hit("p2:a")]))).toBe("DRAW");
  });
});
