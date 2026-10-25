import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { blackKeyLaneSettings } from "../black-key-lanes";
import { settings as core } from "../core/settings";
import { applyDip, emptyStage, feverStage, frameBudget, look, reduceStage, STAGE_KEY, stageOpacity, stageSettings } from ".";

const run = (events: GameEvent[]) => events.reduce(reduceStage, emptyStage());
const combo = (count: number, atMs = 0): GameEvent => ({ type: "combo", count, atMs });

describe("reduceStage", () => {
  it("goes hot on feverStart and back on feverEnd", () => {
    const on = run([{ type: "feverStart", atMs: 1000 }]);
    expect(look(on, 1000 + stageSettings.feverEaseMs).heat).toBe(1);
    const off = reduceStage(on, { type: "feverEnd", atMs: 5000 });
    expect(look(off, 5000 + stageSettings.feverEaseMs).heat).toBe(0);
    expect(look(emptyStage(), 0).heat).toBe(0);
  });

  it("a miss or WRONG alone doesn't dip; miss-moment's dip() takes about 15% for about 100 ms", () => {
    for (const bad of [
      { type: "noteMiss", noteId: "n", pitch: 60, atMs: 2000 },
      { type: "wrongNote", pitch: 61, atMs: 2000 },
    ] as GameEvent[]) {
      const s = run([combo(25), bad]);
      expect(look(s, 2000).dip).toBe(0);
      const d = applyDip(s, 2000);
      expect(look(d, 2000).dip).toBeCloseTo(0.15);
      expect(look(d, 2050).dip).toBeGreaterThan(0);
      expect(look(d, 2100).dip).toBe(0);
    }
  });

  it("songStart resets everything", () => {
    const s = run([{ type: "feverStart", atMs: 0 }, combo(40), { type: "noteMiss", noteId: "n", pitch: 60, atMs: 100 }]);
    expect(reduceStage(s, { type: "songStart", atMs: 0 })).toEqual(emptyStage());
  });
});

describe("frameBudget", () => {
  const feed = (dts: number[]) => {
    const over = frameBudget(20, 1000, 0);
    let t = 0;
    over(t);
    return dts.map((dt) => over((t += dt)));
  };

  it("doesn't trip on one slow frame among smooth ones", () => {
    expect(feed([...Array(60).fill(16), 120, ...Array(120).fill(16)]).some(Boolean)).toBe(false);
  });

  it("trips once the mean over 1 s goes above 20 ms", () => {
    const r = feed([...Array(60).fill(16), ...Array(80).fill(25)]);
    expect(r.slice(0, 60).some(Boolean)).toBe(false);
    expect(r.at(-1)).toBe(true);
  });

  it("doesn't trip before a full second of frames", () => {
    expect(feed(Array(30).fill(30)).some(Boolean)).toBe(false); // 900 ms of slow frames
  });

  it("treats a gap of a whole window as a pause, not slowness", () => {
    expect(feed([...Array(60).fill(16), 5000, ...Array(60).fill(16)]).some(Boolean)).toBe(false);
  });

  it("ignores the warm-up after mount", () => {
    const over = frameBudget(20, 1000, 1000);
    over(0);
    expect(over(900)).toBe(false); // one 900 ms frame while shaders compile
  });
});

describe("stageOpacity", () => {
  const worst = (tint: number) => tint + (1 - tint) * stageOpacity(tint) * (1 - core.stageBackdropAlpha);
  it("keeps a black key's lane at or under maxLaneLuma at the default tint", () => {
    expect(worst(blackKeyLaneSettings.tint)).toBeLessThanOrEqual(stageSettings.maxLaneLuma + 1e-12);
    expect(stageOpacity()).toBeCloseTo(0.35 / 0.45, 12); // tint 0 by default since 2026-10-25
  });
  it("gives back the old cap at tint 0", () => {
    expect(stageOpacity(0)).toBeCloseTo(0.35 / 0.45, 12);
  });
});

describe("off switches", () => {
  const chart: Chart = { id: "t", title: "t", composer: "t", source: "t", bpm: 100, beatsPerBar: 4, notes: [] };
  const mount = (query: string) => {
    const p = feverStage();
    expect(p.transformChart!(chart, new URLSearchParams(query))).toBe(chart); // the chart is returned unchanged
    return p.background!({} as HTMLElement);
  };
  afterEach(() => vi.unstubAllGlobals());

  it("?stage=off returns no background", () => {
    vi.stubGlobal("window", {});
    expect(mount("stage=off")).toBeNull();
  });

  it(`localStorage["${STAGE_KEY}"] = "off" returns no background`, () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: (k: string) => (k === STAGE_KEY ? "off" : null) });
    expect(mount("")).toBeNull();
  });
});
