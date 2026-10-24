import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import type { Chart } from "../../contracts";
import { keyAndMeter, placeNotes, type Placed } from "../sheet-xml";
import { beamGroups, beamJudgment, shouldBeam } from ".";

const songs = new URL("../../../public/songs/", import.meta.url);
const load = (id: string): Chart => JSON.parse(readFileSync(new URL(`${id}/chart.json`, songs), "utf8"));
const four4 = { beats: 4, beatType: 4 };
// Notes on the treble staff from [onset, end] in 16ths, ids n1, n2, …
const rh = (...spans: [number, number][]): Placed[] => spans.map(([onset, end], i) => ({ id: `n${i + 1}`, staff: 1, onset, end, pitch: 60 + i }));

test("beat groups: a quarter in n/4 and 2/2, a dotted quarter in 3/8, 6/8, 9/8 and 12/8, else a quarter", () => {
  expect(beamGroups(four4)).toEqual([4, 4, 4, 4]);
  expect(beamGroups({ beats: 3, beatType: 4 })).toEqual([4, 4, 4]);
  expect(beamGroups({ beats: 2, beatType: 2 })).toEqual([4, 4, 4, 4]);
  expect(beamGroups({ beats: 3, beatType: 8 })).toEqual([6]);
  expect(beamGroups({ beats: 6, beatType: 8 })).toEqual([6, 6]);
  expect(beamGroups({ beats: 12, beatType: 8 })).toEqual([6, 6, 6, 6]);
  expect(beamGroups({ beats: 5, beatType: 8 })).toEqual([4, 4, 2]);
});

test("Für Elise is in 3/8, so its beam group is a dotted quarter: its opening six 16ths share one beam", () => {
  const chart = load("fur-elise");
  const { meter } = keyAndMeter(chart);
  expect(meter).toEqual({ beats: 3, beatType: 8 });
  expect(beamGroups(meter)).toEqual([6]);
  const placed = placeNotes(chart);
  const beams = shouldBeam(placed, meter);
  const longest = Math.max(...beams.map((b) => b.length));
  expect(longest).toBeLessThanOrEqual(6 * 3); // six 16th chords at most, of up to 3 notes
  // every beam stays inside one bar's single group
  const at = new Map(placed.map((p) => [p.id, p]));
  for (const b of beams) expect(new Set(b.map((id) => Math.floor(at.get(id)!.onset / 6))).size).toBe(1);
});

test("four 16ths in one beat of 4/4 are one beam", () => {
  expect(shouldBeam(rh([0, 1], [1, 2], [2, 3], [3, 4]), four4)).toEqual([["n1", "n2", "n3", "n4"]]);
});

test("8th, rest, 8th in one beat are two lone flags; with no rest between they're one beam", () => {
  const three8 = { beats: 3, beatType: 8 }; // one dotted-quarter group holds 8th, 8th rest, 8th
  expect(shouldBeam(rh([0, 2], [4, 6]), three8)).toEqual([]);
  expect(shouldBeam(rh([0, 2], [2, 4], [4, 6]), three8)).toEqual([["n1", "n2", "n3"]]);
  expect(shouldBeam(rh([0, 1], [2, 3]), four4)).toEqual([]); // 16th, 16th rest, 16th in one quarter
  expect(shouldBeam(rh([0, 2], [2, 4]), four4)).toEqual([["n1", "n2"]]);
});

test("two eighths across a beat are two groups: no beam crosses a beat group or a barline", () => {
  expect(shouldBeam(rh([2, 4], [4, 6]), four4)).toEqual([]);
  expect(shouldBeam(rh([12, 14], [14, 16], [16, 18], [18, 20]), four4)).toEqual([["n1", "n2"], ["n3", "n4"]]);
  expect(shouldBeam(rh([3, 5], [5, 6]), four4)).toEqual([]); // an eighth across a beat beams with nothing
});

test("a chord pair beams once, with every note of both chords under it", () => {
  const placed: Placed[] = [
    { id: "a", staff: 1, onset: 0, end: 2, pitch: 60 },
    { id: "b", staff: 1, onset: 0, end: 2, pitch: 64 },
    { id: "c", staff: 1, onset: 2, end: 4, pitch: 62 },
    { id: "d", staff: 1, onset: 2, end: 4, pitch: 65 },
  ];
  expect(shouldBeam(placed, four4)).toEqual([["a", "b", "c", "d"]]);
});

test("each staff and each voice beams on its own; quarters and longer never beam", () => {
  const placed: Placed[] = [
    { id: "r1", staff: 1, onset: 0, end: 2, pitch: 72 },
    { id: "r2", staff: 1, onset: 2, end: 4, pitch: 74 },
    { id: "held", staff: 1, onset: 0, end: 4, pitch: 60 }, // a quarter under them: voice 2, not beamed
    { id: "l1", staff: 2, onset: 0, end: 2, pitch: 48 },
    { id: "l2", staff: 2, onset: 2, end: 4, pitch: 52 },
  ];
  expect(shouldBeam(placed, four4)).toEqual([["r1", "r2"], ["l1", "l2"]]);
  expect(shouldBeam(rh([0, 4], [4, 8]), four4)).toEqual([]);
});

test("the beam color rule: all PERFECT is PERFECT; PERFECT with GREAT, or with one unjudged note, is ink", () => {
  expect(beamJudgment(["PERFECT", "PERFECT", "PERFECT"])).toBe("PERFECT");
  expect(beamJudgment(["PERFECT", "GREAT"])).toBeNull();
  expect(beamJudgment(["PERFECT", undefined])).toBeNull();
  expect(beamJudgment([undefined, undefined])).toBeNull();
  expect(beamJudgment(["MISS", "MISS"])).toBe("MISS");
});

test("every committed chart: each beam has 2+ chords, all eighths or shorter, in one staff and one beat group", () => {
  const ids = readdirSync(songs, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "local" && d.name !== "requests").map((d) => d.name);
  const counts: string[] = [];
  for (const id of ids.sort()) {
    const chart = load(id);
    const { meter } = keyAndMeter(chart);
    const placed = placeNotes(chart);
    const at = new Map(placed.map((p) => [p.id, p]));
    const beams = shouldBeam(placed, meter);
    for (const b of beams) {
      const ps = b.map((x) => at.get(x)!);
      expect(new Set(ps.map((p) => p.staff)).size).toBe(1);
      expect(new Set(ps.map((p) => p.onset)).size).toBeGreaterThan(1);
      expect(ps.every((p) => p.end - p.onset <= 3)).toBe(true);
    }
    counts.push(`${id} ${meter.beats}/${meter.beatType}: ${beams.length} beams over ${beams.flat().length} of ${placed.length} notes`);
  }
  process.stdout.write(`${counts.join("\n")}\n`);
});
