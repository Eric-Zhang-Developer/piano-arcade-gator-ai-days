import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { Judge } from "../core/judge";
import { FEVER_COMBO } from "../core/settings";
import { BOTS, botPresses, feverChart, scenes, type BotName } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

function judge(chart: Chart, name: BotName) {
  const events: GameEvent[] = [];
  const j = new Judge(chart, (e) => events.push(e));
  botPresses(chart, name).forEach((p, i) => j.press(p.pitch, p.timeMs, i));
  return { results: j.finish(1e9), events };
}

describe("bots on Twinkle, judged by the real judge", () => {
  it.each(BOTS)("%s presses the same notes on two runs", (name) => {
    expect(botPresses(twinkle, name)).toEqual(botPresses(twinkle, name));
  });

  it("perfect gives S with a full combo", () => {
    const { results, events } = judge(twinkle, "perfect");
    expect(results.rank).toBe("S");
    expect(results.counts.PERFECT).toBe(twinkle.notes.length);
    expect(events.some((e) => e.type === "fullCombo")).toBe(true);
  });

  it("late gives all GREAT with a +40 ms mean", () => {
    const { results } = judge(twinkle, "late");
    expect(results.counts.GREAT).toBe(twinkle.notes.length);
    const offsets = results.judgments.map((j) => j.offsetMs!);
    expect(offsets.reduce((a, b) => a + b, 0) / offsets.length).toBe(40);
  });

  it.each(["a", "b", "c", "d"] as const)("rank-%s lands rank %s", (r) => {
    expect(judge(twinkle, `rank-${r}`).results.rank).toBe(r.toUpperCase());
  });

  it("sloppy is a mix of PERFECT, GREAT, GOOD and MISS, with WRONG notes", () => {
    const { counts } = judge(twinkle, "sloppy").results;
    for (const k of ["PERFECT", "GREAT", "GOOD", "MISS"] as const) expect(counts[k]).toBeGreaterThan(0);
    expect(counts.wrong).toBe(3);
  });

  it("fever repeats the chart past the fever threshold, adds no new pitches, and reaches feverStart", () => {
    const chart = feverChart(twinkle);
    expect(chart.notes.length).toBeGreaterThanOrEqual(FEVER_COMBO + 10);
    expect(new Set(chart.notes.map((n) => n.pitch))).toEqual(new Set(twinkle.notes.map((n) => n.pitch)));
    expect(new Set(chart.notes.map((n) => n.id)).size).toBe(chart.notes.length);
    const { events, results } = judge(chart, "fever");
    expect(events.some((e) => e.type === "feverStart")).toBe(true);
    expect(results.rank).toBe("S");
  });
});

describe("the plugin", () => {
  const params = (s: string) => new URLSearchParams(s);
  it("an unknown name plays normally: chart and laptop keys untouched", () => {
    const p = scenes();
    expect(p.transformChart!(twinkle, params("bot=nope"))).toBe(twinkle);
    const keys = { kind: "keys" as const, start() {}, stop() {} };
    expect(p.wrapInput!(keys)).toBe(keys);
  });

  it("?bot=perfect replaces only the laptop keys, with a test device; MIDI stays", () => {
    const p = scenes();
    p.transformChart!(twinkle, params("bot=perfect"));
    const midi = { kind: "midi" as const, start() {}, stop() {} };
    expect(p.wrapInput!(midi)).toBe(midi);
    expect(p.wrapInput!({ kind: "keys", start() {}, stop() {} }).kind).toBe("test");
  });

  it("?bot=fever lengthens the chart", () => {
    expect(scenes().transformChart!(twinkle, params("bot=fever")).notes.length).toBeGreaterThan(twinkle.notes.length);
  });
});
