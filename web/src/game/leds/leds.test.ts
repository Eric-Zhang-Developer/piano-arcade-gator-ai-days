import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { hintDiff, hintsAt, judgedKey, rgb7, type Message, type Rgb } from "./messages";

// Twinkle: one hand, 600 ms a beat; C C G G A A G (60 60 67 67 69 69 67) from 0 ms.
const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const MINT: Rgb = [23, 60, 49]; // #5ef2c4, the one-hand note color, at half
const keys = (m: Map<number, Rgb>) => [...m.keys()];

describe("rgb7", () => {
  it("scales #rrggbb to 0-127", () => {
    expect(rgb7("#ffffff")).toEqual([127, 127, 127]);
    expect(rgb7("#5ef2c4", 0.5)).toEqual(MINT);
    expect(rgb7("#ffffff", 3)).toEqual([127, 127, 127]);
  });
});

describe("hintsAt (led-game)", () => {
  it("lights a key 600 ms before its note, once per key", () => {
    expect(keys(hintsAt(chart, -601, new Set()))).toEqual([]);
    expect(hintsAt(chart, -600, new Set())).toEqual(new Map([[60, MINT]]));
    expect(keys(hintsAt(chart, 0, new Set()))).toEqual([60]); // notes 1 and 2 are both C
    expect(keys(hintsAt(chart, 600, new Set()))).toEqual([60, 67]);
  });

  it("drops judged notes", () => {
    const [a, b] = chart.notes;
    expect(keys(hintsAt(chart, 0, new Set([a.id])))).toEqual([60]); // the second C is next
    expect(keys(hintsAt(chart, 700, new Set([a.id, b.id])))).toEqual([67]);
  });
});

describe("hintDiff", () => {
  it("sends new hints and clears the gone ones with 0, 0, 0", () => {
    expect(hintDiff(new Map(), new Map([[60, MINT]]))).toEqual([[0xa0, 60, ...MINT]]);
    expect(hintDiff(new Map([[60, MINT]]), new Map([[60, MINT]]))).toEqual([]);
    expect(hintDiff(new Map([[60, MINT]]), new Map([[67, MINT]]))).toEqual([
      [0xa0, 67, ...MINT],
      [0xa0, 60, 0, 0, 0],
    ]);
  });

  it("over a whole take: every key glows at least 600 ms before its note, and nothing is left lit", () => {
    const judged = new Set<string>();
    let lit = new Map<number, Rgb>();
    const sent: { atMs: number; m: Message }[] = [];
    const end = noteTimeMs(chart, chart.notes.at(-1)!) + 1000;
    for (let t = -2400; t <= end; t += 16) {
      for (const n of chart.notes) if (noteTimeMs(chart, n) <= t) judged.add(n.id); // each note hit on time
      const want = hintsAt(chart, t, judged);
      for (const m of hintDiff(lit, want)) sent.push({ atMs: t, m });
      lit = want;
    }
    expect(lit.size).toBe(0);
    for (const n of chart.notes) {
      const t = noteTimeMs(chart, n);
      const lastHint = sent.filter((s) => s.m[1] === n.pitch && s.atMs < t).at(-1);
      expect(lastHint?.m.slice(2), `note ${n.id}`).not.toEqual([0, 0, 0]); // lit when it arrives
      // ...and lit since at least 600 ms before (or since the key's last note left it)
      const litAt = lastHint!.atMs;
      const prev = chart.notes.filter((o) => o.pitch === n.pitch && noteTimeMs(chart, o) < t).at(-1);
      expect(litAt, `note ${n.id}`).toBeLessThanOrEqual(Math.max(t - 600, prev ? noteTimeMs(chart, prev) : -Infinity) + 16);
    }
    const lastByKey = new Map(sent.map((s) => [s.m[1], s.m.slice(2)]));
    for (const rgb of lastByKey.values()) expect(rgb).toEqual([0, 0, 0]);
  });
});

describe("judgedKey", () => {
  const at = { atMs: 0 };
  it("a hit lights its key in the HUD's judgment color, a miss red", () => {
    expect(judgedKey({ ...at, type: "noteHit", noteId: "n", pitch: 60, judgment: "PERFECT", offsetMs: 0 })).toEqual([0x90, 60, 127, 113, 61]);
    expect(judgedKey({ ...at, type: "noteMiss", noteId: "n", pitch: 62 })).toEqual([0x90, 62, 127, 38, 47]);
    expect(judgedKey({ ...at, type: "combo", count: 3 } as GameEvent)).toBeNull();
  });
});
