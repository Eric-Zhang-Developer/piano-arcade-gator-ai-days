import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Chart, Frame, GameEvent } from "../../contracts";
import { Judge } from "../core/judge";
import { gaugeSize } from "../fever-gauge/gauge";
import { BOTS, botPresses, feverChart, scenes, scenesSettings, TAKE_FILE, takePresses, type BotName } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

function judge(chart: Chart, name: BotName) {
  const events: GameEvent[] = [];
  const j = new Judge(chart, (e) => events.push(e));
  botPresses(chart, name).forEach((p, i) => j.press(p.pitch, p.timeMs, i));
  return { results: j.finish(1e9), events };
}

describe("bot holds", () => {
  // 120 bpm: a beat is 500 ms. A half note, then the same pitch again; a held whole note under a second voice.
  const chart: Chart = {
    ...twinkle,
    bpm: 120,
    notes: [
      { id: "a", pitch: 60, beat: 0, duration: 2, hand: "R" },
      { id: "b", pitch: 60, beat: 2, duration: 1, hand: "R" },
      { id: "c", pitch: 48, beat: 0, duration: 4, hand: "L" },
      { id: "d", pitch: 64, beat: 3, duration: 1, hand: "R" },
    ],
  };
  const hold = (pitch: number, timeMs: number) => botPresses(chart, "perfect").find((p) => p.pitch === pitch && p.timeMs === timeMs)!.holdMs;

  it("holds each key for its written length, so a legato chart sounds legato", () => {
    expect(hold(48, 0)).toBe(2000); // the whole note, under the other voice's notes
    expect(hold(64, 1500)).toBe(500);
  });

  it("lets go just before the same pitch strikes again", () => {
    expect(hold(60, 0)).toBe(1000 - scenesSettings.restrikeGapMs);
    expect(hold(60, 1000)).toBe(500);
  });
});

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

  it("fever reaches feverStart on Twinkle and holds it to an S, with no copy needed", () => {
    expect(feverChart(twinkle).notes).toEqual(twinkle.notes);
    const { events, results } = judge(twinkle, "fever");
    expect(events.some((e) => e.type === "feverStart")).toBe(true);
    expect(events.some((e) => e.type === "feverEnd")).toBe(false);
    expect(results.rank).toBe("S");
  });

  it("fever repeats a chart too short to fill the gauge, adding no new pitches", () => {
    const short: Chart = { ...twinkle, notes: twinkle.notes.slice(0, 7) };
    const chart = feverChart(short);
    expect(chart.notes.length).toBeGreaterThanOrEqual(gaugeSize(chart.notes.length) + 10);
    expect(new Set(chart.notes.map((n) => n.pitch))).toEqual(new Set(short.notes.map((n) => n.pitch)));
    expect(new Set(chart.notes.map((n) => n.id)).size).toBe(chart.notes.length);
    expect(judge(chart, "fever").events.some((e) => e.type === "feverStart")).toBe(true);
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

  it("on a starved page every press reaches the judge within a frame, timed by /play's own zero (#586)", async () => {
    let perf = 0;
    const raf: (() => void)[] = [];
    vi.spyOn(performance, "now").mockImplementation(() => perf);
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => raf.push(cb));
    vi.stubGlobal("setTimeout", () => 0); // every timer starved behind frames: none fires
    vi.stubGlobal("clearTimeout", () => {});
    try {
      const p = scenes();
      const chart = p.transformChart!(twinkle, params("bot=perfect"));
      const presses = botPresses(chart, "perfect");
      const zero = 1000; // /play's chart zero, in performance.now() time
      const got: { timeMs: number; at: number }[] = [];
      await p.wrapInput!({ kind: "keys", start() {}, stop() {} }).start((e) => void (e.type === "on" && got.push({ timeMs: e.timeMs, at: perf })));
      for (let t = 0; t < zero + presses.at(-1)!.timeMs + 500; t += 100) {
        perf = t; // a frame every 100 ms: first the callbacks queued in the last one
        raf.splice(0).forEach((cb) => cb());
        const nowMs = t + 0.5 - zero; // then /play reads its clock
        perf = t + 40; // and draws the highway and the plugins before this one
        p.draw!({} as CanvasRenderingContext2D, { nowMs } as Frame);
      }
      expect(got.length).toBe(presses.length);
      got.forEach((g, i) => {
        expect(Math.abs(g.timeMs - zero - presses[i].timeMs)).toBeLessThan(1); // judged at its time, not 40 ms late
        expect(g.at - zero - presses[i].timeMs).toBeLessThanOrEqual(100); // sent by the next frame, before its sweep
      });
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });

  it("?bot=fever lengthens a short chart", () => {
    const short: Chart = { ...twinkle, notes: twinkle.notes.slice(0, 7) };
    expect(scenes().transformChart!(short, params("bot=fever")).notes.length).toBeGreaterThan(7);
  });
});

describe("bot=take", () => {
  it("takes only a plain .mid name, so nothing outside /takes/ is fetched", () => {
    expect(TAKE_FILE.test("fur-elise-20261024-1900.mid")).toBe(true);
    expect(TAKE_FILE.test("verify.mid")).toBe(true);
    for (const bad of ["../x.mid", "a/b.mid", "x.midi", "", "https://example.com/x.mid", "x.mid?y"]) expect(TAKE_FILE.test(bad), bad).toBe(false);
  });

  it("presses each note with its own velocity and hold, in time order", () => {
    expect(
      takePresses([
        { pitch: 64, velocity: 30, timeMs: 500, offTimeMs: 650 },
        { pitch: 60, velocity: 110, timeMs: -120, offTimeMs: 200 },
      ]),
    ).toEqual([
      { pitch: 60, timeMs: -120, holdMs: 320, velocity: 110 },
      { pitch: 64, timeMs: 500, holdMs: 150, velocity: 30 },
    ]);
  });
});
