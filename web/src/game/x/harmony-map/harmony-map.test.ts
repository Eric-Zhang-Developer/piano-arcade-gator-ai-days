// harmony-map's Validation (a): the lattice, the triads, a progression's triangles and edges, and P, L and R.
import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { chartReadings, read } from "./chords";
import { stats } from "./constellation";
import { corners, fromId, nearest, pc, plr, triadId, triadName } from "./tonnetz";

const chart = (chords: number[][], beats = 2, extra: Partial<Chart> = {}): Chart => ({
  id: "t",
  title: "t",
  composer: "t",
  source: "t",
  bpm: 120,
  beatsPerBar: 4,
  notes: chords.flatMap((ps, i) => ps.map((pitch, j) => ({ id: `${i}-${j}`, pitch, beat: i * beats, duration: beats, hand: "R" as const }))),
  ...extra,
});
const names = (ids: Iterable<number>) => [...ids].map((id) => triadName(fromId(id)));

describe("the lattice", () => {
  it("is pc(x, y) = (7x + 4y) mod 12: a fifth along x, a major third along y, a minor third along (1, −1)", () => {
    expect(pc(0, 0)).toBe(0);
    expect(pc(1, 0)).toBe(7);
    expect(pc(0, 1)).toBe(4);
    expect(pc(1, -1)).toBe(3);
    expect(pc(-3, 5)).toBe((7 * -3 + 4 * 5 + 24) % 12);
  });
  it("a patch of 7 × 5 points holds all 12 pitch classes", () => {
    const seen = new Set<number>();
    for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) seen.add(pc(x, y));
    expect(seen.size).toBe(12);
  });
  it("a triad's triangle holds its three notes, wherever its copy lands", () => {
    for (const id of [0, 7, 21, 13])
      for (const near of [[0, 0], [5, -3], [-4, 2]] as [number, number][]) {
        const t = fromId(id);
        const got = corners(nearest(t, near), t.minor).map(([x, y]) => pc(x, y)).sort((a, b) => a - b);
        expect(got).toEqual([t.root, (t.root + (t.minor ? 3 : 4)) % 12, (t.root + 7) % 12].sort((a, b) => a - b));
      }
  });
});

describe("the triads", () => {
  it("C E G is C, A C E is Am", () => {
    expect(read([60, 64, 67]).triad).toEqual({ root: 0, minor: false });
    expect(read([57, 60, 64]).triad).toEqual({ root: 9, minor: true });
  });
  it("C E G♯ (augmented), a dyad, a cluster and a major seventh light nodes and no triangle", () => {
    for (const ps of [[60, 64, 68], [60, 67], [60, 61, 62, 63], [60, 64, 67, 71]]) {
      const r = read(ps);
      expect(r.triad, ps.join(" ")).toBeNull();
      expect(r.pcs.length).toBeGreaterThan(0);
    }
  });
  it("a note released under a held pedal still counts toward the triad", () => {
    const c: Chart = { ...chart([]), notes: [
      { id: "c", pitch: 48, beat: 0, duration: 0.5, hand: "L" },
      { id: "e", pitch: 64, beat: 2, duration: 1, hand: "R" },
      { id: "g", pitch: 67, beat: 2, duration: 1, hand: "R" },
    ] };
    expect(chartReadings(c, [[0, 4]]).find((r) => r.beat === 2)!.reading.triad).toEqual({ root: 0, minor: false });
    expect(chartReadings(c, null).find((r) => r.beat === 2)!.reading.triad).toBeNull();
  });
});

describe("a progression", () => {
  it("I–IV–V–I in C draws the triangles C, F, G, C and the edges C–F, F–G, G–C once each", () => {
    const st = stats(chart([[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]]), null);
    expect(names(st.order)).toEqual(["C", "F", "G", "C"]);
    expect(names(st.beats.keys()).sort()).toEqual(["C", "F", "G"]);
    expect(st.beats.get(0)).toBe(4);
    expect(Object.fromEntries(st.edges)).toEqual({ "0-5": 1, "5-7": 1, "0-7": 1 });
    expect(st.home).toBe(0);
  });
  it("counts an edge each time it's taken, either way", () => {
    const C = [60, 64, 67];
    const G = [67, 71, 74];
    const st = stats(chart([C, G, C, G, C]), null);
    expect(st.edges.get(`${triadId({ root: 0, minor: false })}-${triadId({ root: 7, minor: false })}`)).toBe(4);
  });
});

describe("P, L and R", () => {
  const C = { root: 0, minor: false };
  it("C→Cm is P, C→Em is L, C→Am is R, and back", () => {
    expect(plr(C, { root: 0, minor: true })).toBe("P");
    expect(plr(C, { root: 4, minor: true })).toBe("L");
    expect(plr(C, { root: 9, minor: true })).toBe("R");
    expect(plr({ root: 9, minor: true }, C)).toBe("R");
    expect(plr(C, { root: 7, minor: false })).toBeNull();
  });
  it("each is a shared edge on the lattice: the two triangles meet on two notes", () => {
    for (const to of [{ root: 0, minor: true }, { root: 4, minor: true }, { root: 9, minor: true }]) {
      const a = corners(nearest(C, [0, 0]), false).map((p) => p.join());
      const b = corners(nearest(to, [0.5, -0.3]), true).map((p) => p.join());
      expect(a.filter((p) => b.includes(p)).length, triadName(to)).toBe(2);
    }
  });
});
