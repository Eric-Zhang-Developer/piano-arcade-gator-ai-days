import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { Judge, noteTimeMs } from "../core/judge";
import { barLoop, loopChart } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const q = (s: string) => new URLSearchParams(s);

describe("loopChart (pure)", () => {
  it("keeps exactly the notes in bars 1–2, re-timed for the tempo, once per pass", () => {
    const r = loopChart(twinkle, q("from=1&to=2&tempo=70&passes=2"))!;
    const inRange = twinkle.notes.filter((n) => n.beat >= 0 && n.beat < 8);
    expect(r.plan.notesPerPass).toBe(inRange.length);
    expect(r.chart.notes).toHaveLength(2 * inRange.length);
    expect(r.chart.bpm).toBeCloseTo(twinkle.bpm * 0.7);
    // Pass 2 starts after the 8 beats of bars 1–2 and a one-bar gap: beat 12.
    expect(r.chart.notes.map((n) => [n.pitch, n.beat])).toEqual([
      ...inRange.map((n) => [n.pitch, n.beat]),
      ...inRange.map((n) => [n.pitch, n.beat + 12]),
    ]);
    expect(new Set(r.chart.notes.map((n) => n.id)).size).toBe(r.chart.notes.length);
  });

  it("starts a later range at beat 0", () => {
    const r = loopChart(twinkle, q("from=3&to=3&passes=1"))!;
    const bar3 = twinkle.notes.filter((n) => n.beat >= 8 && n.beat < 12);
    expect(r.chart.notes.map((n) => n.beat)).toEqual(bar3.map((n) => n.beat - 8));
    expect(r.chart.bpm).toBe(twinkle.bpm);
  });

  it("changes nothing without from, to or tempo", () => {
    expect(loopChart(twinkle, q("song=twinkle"))).toBeNull();
  });

  it("tempo alone plays every note once at that tempo, the whole song (song-options' Speed)", () => {
    const r = loopChart(twinkle, q("tempo=70"))!;
    expect(r.chart.notes.map((n) => [n.pitch, n.beat, n.duration])).toEqual(twinkle.notes.map((n) => [n.pitch, n.beat, n.duration]));
    expect(r.chart.bpm).toBeCloseTo(twinkle.bpm * 0.7);
    expect(r.plan).toMatchObject({ from: 1, to: 12, passes: 1, whole: true });
  });

  it("tempo with from and to is unchanged: the bar range, four passes", () => {
    expect(loopChart(twinkle, q("tempo=70&from=1&to=2"))!.plan).toMatchObject({ from: 1, to: 2, passes: 4, whole: false });
  });

  it.each([
    ["from=0&to=2", /aren't in this chart/],
    ["from=3&to=2", /aren't in this chart/],
    ["from=1&to=99", /bars 1–12/],
    ["from=1", /aren't in this chart/],
    ["from=1&to=2&tempo=20", /tempo must be 25–150/],
    ["from=1&to=2&tempo=151", /tempo must be/],
    ["from=1&to=2&passes=0", /passes must be/],
  ])("rejects %s", (s, msg) => {
    expect(() => loopChart(twinkle, q(s))).toThrow(msg);
  });
});

describe("per-pass results", () => {
  it("scores each pass on its own, through the real judge", () => {
    const plugin = barLoop();
    const chart = plugin.transformChart!(twinkle, q("from=1&to=2&tempo=70&passes=3"));
    const judge = new Judge(chart, (e: GameEvent) => plugin.onEvent!(e));
    plugin.onEvent!({ type: "songStart", atMs: 0 });
    // Pass 1 perfect, pass 2 skips one note, pass 3 every note 40 ms late (GREAT).
    chart.notes.forEach((n, i) => {
      const pass = Number(n.id[1]);
      if (n.id === `p2-${twinkle.notes[0].id}`) return;
      judge.press(n.pitch, noteTimeMs(chart, n) + (pass === 3 ? 40 : 0), i);
    });
    judge.finish(1e9);
    const per = chart.notes.length / 3;
    expect(plugin.passes()).toEqual([1, (per - 1) / per, 0.5]);
  });

  it("counts a wrong note against the pass it fell in", () => {
    const plugin = barLoop();
    const chart = plugin.transformChart!(twinkle, q("from=1&to=1&passes=2"));
    const judge = new Judge(chart, (e: GameEvent) => plugin.onEvent!(e));
    plugin.onEvent!({ type: "songStart", atMs: 0 });
    chart.notes.forEach((n, i) => judge.press(n.pitch, noteTimeMs(chart, n), i));
    const pass2 = noteTimeMs(chart, chart.notes.find((n) => n.id.startsWith("p2-"))!);
    judge.press(30, pass2 + 300, 99); // a pitch nowhere in the chart, during pass 2
    judge.finish(1e9);
    const per = chart.notes.length / 2;
    expect(plugin.passes()).toEqual([1, per / (per + 1)]);
  });
});
