import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { hudSettings, tierFor } from "../hud";
import { emptyStage, feverStage, frameBudget, gridPhase, look, reduceStage, STAGE_KEY, stageSettings } from ".";

const run = (events: GameEvent[]) => events.reduce(reduceStage, emptyStage());
const combo = (count: number, atMs = 0): GameEvent => ({ type: "combo", count, atMs });

describe("reduceStage", () => {
  it("steps tier on the same combo as the HUD's tierFor", () => {
    for (const n of [0, 9, 10, 19, 20, 29, 30, 99]) {
      expect(run([combo(n)]).tier, `combo ${n}`).toBe(hudSettings.tiers.indexOf(tierFor(n)));
    }
    expect([0, 10, 20, 30].map((n) => look(run([combo(n)]), 0).speed)).toEqual(stageSettings.linesPerBeat);
  });

  it("goes hot on feverStart and back on feverEnd", () => {
    const on = run([{ type: "feverStart", atMs: 1000 }]);
    expect(look(on, 1000 + stageSettings.feverEaseMs).heat).toBe(1);
    const off = reduceStage(on, { type: "feverEnd", atMs: 5000 });
    expect(look(off, 5000 + stageSettings.feverEaseMs).heat).toBe(0);
    expect(look(emptyStage(), 0).heat).toBe(0);
  });

  it("flashes the grid on feverStart, as on a count-in beat, and not on feverEnd", () => {
    const on = run([{ type: "feverStart", atMs: 1000 }]);
    expect(look(on, 1000).flash).toBeGreaterThan(0);
    expect(look(on, 1000 + stageSettings.flashMs).flash).toBe(0);
    expect(reduceStage(on, { type: "feverEnd", atMs: 5000 }).flashAtMs).toBe(1000);
  });

  it("dips on a miss and on a WRONG for about 300 ms, and drops the speed to tier 1", () => {
    for (const bad of [
      { type: "noteMiss", noteId: "n", pitch: 60, atMs: 2000 },
      { type: "wrongNote", pitch: 61, atMs: 2000 },
    ] as GameEvent[]) {
      const s = run([combo(25), bad]);
      expect(s.tier).toBe(0);
      expect(look(s, 2000).speed).toBe(stageSettings.linesPerBeat[0]);
      expect(look(s, 2000).dip).toBeGreaterThan(0);
      expect(look(s, 2150).dip).toBeGreaterThan(0);
      expect(look(s, 2300).dip).toBe(0);
    }
  });

  it("bursts once on fullCombo", () => {
    const s = run([{ type: "fullCombo", atMs: 9000 }]);
    expect(look(s, 8999).burst).toBeNull();
    expect(look(s, 9000).burst).toBe(0);
    expect(look(s, 9000 + stageSettings.burstMs / 2).burst).toBeCloseTo(0.5);
    expect(look(s, 9000 + stageSettings.burstMs).burst).toBeNull();
    expect(look(s, 60000).burst).toBeNull();
  });

  it("flashes on each count-in beat, and songStart resets everything", () => {
    const s = run([{ type: "feverStart", atMs: 0 }, combo(40), { type: "countInBeat", beat: 1, atMs: -500 }]);
    expect(look(s, -500).flash).toBe(1);
    expect(look(s, -500 + stageSettings.flashMs).flash).toBe(0);
    expect(reduceStage(s, { type: "songStart", atMs: 0 })).toEqual(emptyStage());
  });
});

describe("gridPhase", () => {
  it("is on a whole line at every whole beat, at any BPM and speed, count-in included", () => {
    for (const bpm of [60, 72, 100, 133, 177.5]) {
      for (const speed of stageSettings.linesPerBeat) {
        for (let beat = -8; beat <= 64; beat++) expect(gridPhase((beat * 60000) / bpm, bpm, speed)).toBe(0);
      }
    }
    expect(gridPhase(300, 100, 1)).toBeCloseTo(0.5); // half a beat at 100 bpm
    expect(gridPhase(-150, 100, 1)).toBeCloseTo(0.75); // count-in: still moving forward
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
