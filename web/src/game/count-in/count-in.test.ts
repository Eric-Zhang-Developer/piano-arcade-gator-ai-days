import { describe, expect, test } from "vitest";
import type { Chart } from "../../contracts";
import { beatHits } from "../beat";
import { msPerBeat } from "../core/settings";
import { countInAt, countInBeats, countInSettings as s } from ".";

const chart = (bpm: number, beatsPerBar = 4): Chart =>
  ({ id: "t", title: "T", composer: "C", source: "test", bpm, beatsPerBar, notes: [{ id: "n1", pitch: 60, beat: 0, duration: 1, hand: "R" }] }) as Chart;

describe("count-in (count-in)", () => {
  test.each([60, 100, 180])("its beats are beat-track's count-in clicks at %i BPM", (bpm) => {
    const c = chart(bpm);
    const clicks = beatHits(c, -8 * msPerBeat(bpm), 0).map((h) => ({ atMs: h.atMs, accent: h.accent }));
    expect(countInBeats(c)).toEqual(clicks);
    expect(clicks).toHaveLength(8);
    expect(clicks.filter((h) => h.accent).map((h) => h.atMs)).toEqual([-8, -4].map((b) => b * msPerBeat(bpm)));
  });

  test("in 3/4 the accents follow beat-track's bars from the count-in's first beat, not the halves", () => {
    const b = countInBeats(chart(120, 3));
    expect(b.map((h) => h.accent)).toEqual([true, false, false, true, false, false, true, false]);
  });

  const beats = countInBeats(chart(100)); // 600 ms a beat, beat 1 at -4800
  const at = (beat: number, dMs = 0) => -4800 + (beat - 1) * 600 + dMs;

  test("each beat ±1 ms: the right numeral, ticks and pulse", () => {
    for (let beat = 1; beat <= 8; beat++) {
      const before = countInAt(beats, at(beat, -1));
      const on = countInAt(beats, at(beat));
      const after = countInAt(beats, at(beat, 1));
      expect(on.beat).toBe(beat);
      expect(before.beat).toBe(beat === 1 ? null : beat - 1);
      expect(after.beat).toBe(beat);
      expect(on.numeral?.text ?? null).toBe(beat <= 4 ? null : String(9 - beat));
      expect(on.pulse).toBe(beat === 1 || beat === 5 ? s.pulsePeak.accent : s.pulsePeak.plain);
      // Whole ticks a frame later: the listen half fills one per beat, the count half stands as many as the numeral.
      const ticks = countInAt(beats, at(beat, s.tickFillMs)).ticks.filter((t) => t >= 1).length;
      expect(ticks).toBe(beat <= 4 ? beat : 9 - beat);
    }
    expect(countInAt(beats, at(1, -1)).ticks).toEqual([0, 0, 0, 0]);
  });

  test("beat 0 burns white for one frame, then nothing", () => {
    expect(countInAt(beats, 0)).toMatchObject({ hot: true, beat: null, numeral: null });
    expect(countInAt(beats, s.frameMs + 1).hot).toBe(false);
  });

  test("a numeral fades in over 40 ms, settles 1.04 to 1 in 120 ms, fades out over the beat's last 30%", () => {
    expect(countInAt(beats, at(5)).numeral).toMatchObject({ alpha: 0, scale: 1.04 });
    expect(countInAt(beats, at(5, 20)).numeral!.alpha).toBeCloseTo(0.5);
    expect(countInAt(beats, at(5, 40)).numeral!.alpha).toBe(1);
    expect(countInAt(beats, at(5, 60)).numeral!.scale).toBeGreaterThan(1);
    expect(countInAt(beats, at(5, 120)).numeral!.scale).toBe(1);
    expect(countInAt(beats, at(5, 420)).numeral!.alpha).toBe(1); // 70% of 600
    expect(countInAt(beats, at(5, 510)).numeral!.alpha).toBeCloseTo(0.5);
    expect(countInAt(beats, at(5, 599.9)).numeral!.alpha).toBeLessThan(0.01);
  });

  test("reduced motion: numerals whole for the beat, ticks filled at once, the pulse a steady tint", () => {
    for (const d of [0, 20, 300, 599]) {
      const c = countInAt(beats, at(6, d), true);
      expect(c.numeral).toMatchObject({ text: "3", alpha: 1, scale: 1 });
      expect(c.pulse).toBe(s.pulsePeak.plain);
    }
    expect(countInAt(beats, at(2), true).ticks).toEqual([1, 1, 0, 0]);
  });
});
