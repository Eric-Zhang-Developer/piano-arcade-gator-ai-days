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

// golden-demo: the bot's pedal and dynamics, heard on the piano output. Synthetic chart, 500 ms a beat.
describe("the bot on the piano: pedal and velocity", () => {
  const chart: Chart = {
    ...twinkle,
    id: "local/synthetic",
    bpm: 120,
    notes: [
      { id: "a", pitch: 60, beat: 0, duration: 1, hand: "R", velocity: 40 },
      { id: "b", pitch: 64, beat: 1, duration: 1, hand: "R", velocity: 100 },
      { id: "c", pitch: 67, beat: 2, duration: 1, hand: "R" },
    ],
  };
  const pedal = { pedal: [[0.1, 0.9], [1.1, 2.9]] }; // 50–450 ms and 550–1450 ms
  const on = (p: number, v: number) => [0x90, p, v];
  const off = (p: number) => [0x90, p, 0];
  const cc = (v: number) => [0xb0, 64, v];

  // A starved page, as in the #586 test: frames every 100 ms drive the pump, and no timer fires.
  async function harness(pedalFile: () => Promise<unknown> = async () => pedal) {
    let perf = 0;
    const raf: (() => void)[] = [];
    const sent: number[][] = [];
    vi.spyOn(performance, "now").mockImplementation(() => perf);
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => raf.push(cb));
    vi.stubGlobal("setTimeout", () => 0);
    vi.stubGlobal("clearTimeout", () => {});
    vi.stubGlobal("fetch", async () => ({ ok: true, json: pedalFile }));
    const piano = { name: "Portable Grand", send: (d: number[]) => void sent.push([...d]) };
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map([["dgx", piano]]) }) });
    const p = scenes();
    p.transformChart!(chart, new URLSearchParams("song=local/synthetic&bot=perfect&audible=1"));
    await new Promise((r) => setImmediate(r)); // the pedal read
    await p.wrapInput!({ kind: "keys", start() {}, stop() {} }).start(() => {});
    let zero = 0;
    // Frames from chart time `fromMs` to `toMs`, with chart zero put where that makes `fromMs` now.
    const frames = (fromMs: number, toMs: number) => {
      zero = perf + 100 - fromMs;
      for (let t = perf + 100; t - zero <= toMs; t += 100) {
        perf = t;
        raf.splice(0).forEach((cb) => cb());
        perf = t + 40;
        p.draw!({} as CanvasRenderingContext2D, { nowMs: t + 0.5 - zero } as Frame);
      }
    };
    return { p, sent, frames };
  }
  // What the piano heard from the first note on: the pedal-ups every cancel sends before it are housekeeping.
  const heard = (sent: number[][]) => sent.slice(sent.findIndex((m) => m[0] === 0x90 || m[2] === 127));
  const cleanup = () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  };

  it("presses at the chart's velocity, KEYS_VELOCITY where it has none, with CC64 on the notes' queue in time order", async () => {
    try {
      const { sent, frames } = await harness();
      frames(-200, 1700);
      expect(heard(sent)).toEqual([
        on(60, 40), cc(127), cc(0), off(60), on(64, 100), cc(127), off(64), on(67, 80), cc(0), off(67),
      ]);
    } finally {
      cleanup();
    }
  });

  it.each(["pause", "quit", "songEnd"] as const)("%s mid-pair ends with the pedal up", async (type) => {
    try {
      const { p, sent, frames } = await harness();
      frames(-200, 700);
      expect(sent.at(-1)).toEqual(cc(127));
      p.onEvent!({ type } as GameEvent);
      expect(sent.at(-1)).toEqual(cc(0));
    } finally {
      cleanup();
    }
  });

  it("a resume inside a pair puts that pair's pedal down first, then only what's ahead", async () => {
    try {
      const { p, sent, frames } = await harness();
      frames(-200, 700);
      p.onEvent!({ type: "pause" } as GameEvent);
      const at = sent.length;
      p.onEvent!({ type: "resume", atMs: 800 } as GameEvent);
      frames(800, 1700);
      expect(heard(sent.slice(at))).toEqual([cc(127), off(64), on(67, 80), cc(0), off(67)]);
    } finally {
      cleanup();
    }
  });

  it("a pedal read after the bot started still sends what's ahead of it", async () => {
    try {
      let arrive: (v: unknown) => void = () => {};
      const { sent, frames } = await harness(() => new Promise((r) => (arrive = r)));
      frames(-200, 500); // the first pair is over by now
      arrive(pedal);
      await new Promise((r) => setImmediate(r));
      frames(600, 1700);
      expect(heard(sent).filter((m) => m[0] === 0xb0)).toEqual([cc(127), cc(0)]);
    } finally {
      cleanup();
    }
  });

  it("no pedal.json, no pedal: only notes after the housekeeping", async () => {
    try {
      const { sent, frames } = await harness(async () => null);
      frames(-200, 1700);
      expect(heard(sent).some((m) => m[0] === 0xb0 && m[2] === 127)).toBe(false);
    } finally {
      cleanup();
    }
  });
});
