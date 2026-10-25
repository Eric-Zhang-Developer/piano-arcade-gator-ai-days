import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameEvent, Results } from "../../contracts";
import { stampImpactMs } from "../rank-stamp";
import { eventSounds, savePrefs, scheduler, soundSettings, type SchedulerOptions } from "../sound";
import { comboLift, playVoice, voiceSettings, type Voice } from "./voices";
import { clearWatch, levelEnvelope, loudnessGain, loudnessSettings, newRecordImpactMs } from ".";

const results = {} as Results;
const opts = (o: Partial<SchedulerOptions> = {}): SchedulerOptions => ({
  notes: 300,
  wait: false,
  missCue: () => true,
  newRecord: () => false,
  levelAt: () => null,
  ...o,
});
const run = (events: GameEvent[], o?: Partial<SchedulerOptions>) => {
  const next = scheduler(opts(o));
  return events.flatMap((e) => next(e, 0).map((s) => ({ ...s, ms: Math.round(s.startTime * 1000) })));
};

// A scripted take: 300 notes all PERFECT, a hit every 250 ms, with its combo events, milestones and fever.
function take(): GameEvent[] {
  const ev: GameEvent[] = [{ type: "songStart", atMs: -2000 }];
  for (let i = 1; i <= 300; i++) {
    const atMs = i * 250;
    ev.push({ type: "noteHit", noteId: `n${i}`, pitch: 60 + (i % 12), judgment: "PERFECT", offsetMs: 0, atMs });
    ev.push({ type: "combo", count: i, atMs });
    if (i === 25 || i === 50 || i % 100 === 0) ev.push({ type: "comboMilestone", count: i, atMs });
    if (i === 60) ev.push({ type: "feverStart", atMs });
  }
  ev.push({ type: "fullCombo", atMs: 76000 }, { type: "songEnd", results, atMs: 76000 });
  return ev;
}

describe("never per hit", () => {
  it("300 hits schedule sounds only at the milestones", () => {
    const got = run(take(), { newRecord: () => true }).map((s) => `${s.sound}@${s.ms}`);
    expect(got).toEqual([
      "stinger@6250",
      "stinger@12500",
      "sweep@15000",
      "stinger@25000",
      "stinger@50000",
      "allPerfect@75000", // the clear card, on the last note; the 300 step on that note gives way to it
      `fanfare@${76000 + stampImpactMs() + soundSettings.fanfareAfterHitMs}`,
      "drumroll@76000",
      `rankHit@${76000 + stampImpactMs()}`,
      `newRecord@${76000 + newRecordImpactMs()}`,
    ]);
  });

  it("a combo step carries its count, and higher steps start higher", () => {
    expect(
      run(take())
        .filter((s) => s.sound === "stinger")
        .map((s) => s.count),
    ).toEqual([25, 50, 100, 200]);
    expect([25, 50, 100, 200, 300, 900].map(comboLift)).toEqual([0, 2, 3, 4, 5, 7]);
  });

  it("the clear card's voice follows clear-card's kind, once per take", () => {
    const hit = (judgment: "PERFECT" | "GREAT", atMs: number): GameEvent => ({
      type: "noteHit",
      noteId: "n",
      pitch: 60,
      judgment,
      offsetMs: 0,
      atMs,
    });
    const miss: GameEvent = { type: "noteMiss", noteId: "n", pitch: 60, atMs: 200 };
    const card = (events: GameEvent[]) => run(events, { notes: 2, missCue: () => false }).map((s) => s.sound);
    expect(card([hit("PERFECT", 100), hit("PERFECT", 200)])).toEqual(["allPerfect"]);
    expect(card([hit("PERFECT", 100), hit("GREAT", 200)])).toEqual(["fullComboCard"]);
    expect(card([hit("PERFECT", 100), miss])).toEqual(["clear"]);
    const watch = clearWatch(1);
    expect([
      watch(hit("PERFECT", 100)),
      watch({ type: "extra", pitch: 61, atMs: 300 }),
      watch(hit("PERFECT", 400)),
    ]).toEqual(["ALL PERFECT", null, null]);
  });

  it("no new record, no NEW RECORD sound", () => {
    expect(run(take()).some((s) => s.sound === "newRecord")).toBe(false);
  });
});

describe("settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("the miss cue setting still gates the miss cue, and the miss cue skips the loudness rule", () => {
    const miss: GameEvent[] = [{ type: "noteMiss", noteId: "n", pitch: 60, atMs: 700 }];
    expect(run(miss, { notes: 9, missCue: () => false })).toEqual([]);
    expect(run(miss, { notes: 9, levelAt: () => 0 })).toMatchObject([{ sound: "miss", gain: 1 }]);
  });

  it("wait mode schedules no clear card and nothing at songEnd", () => {
    const got = run(take(), { wait: true, newRecord: () => true }).map((s) => s.sound);
    expect(got).not.toContain("allPerfect");
    for (const end of ["fanfare", "drumroll", "rankHit", "newRecord"]) expect(got).not.toContain(end);
  });

  it("Mute takes the effects gain to zero, with every voice routed through it", () => {
    // A fake Web Audio: each node is a proxy; sets of .value are recorded, and connect returns the node it's given.
    const values: number[] = [];
    let starts = 0;
    const node = (): unknown =>
      new Proxy(() => {}, {
        get: (_, k) =>
          k === "start"
            ? () => starts++
            : k === "connect"
              ? (n: unknown) => n
              : k === Symbol.toPrimitive
                ? () => 0
                : k === "then"
                  ? undefined
                  : node(),
        apply: () => node(),
        set: (_, k, v) => (k === "value" && values.push(v), true),
      });
    vi.stubGlobal("AudioContext", function () {
      return node();
    });
    savePrefs({ volume: 0.5, muted: false, missCue: true });
    const p = eventSounds();
    p.transformChart!({ notes: [{}] } as never, new URLSearchParams());
    p.onEvent!({ type: "songStart", atMs: 0 });
    p.onEvent!({ type: "comboMilestone", count: 25, atMs: 100 });
    expect(starts).toBeGreaterThan(0);
    savePrefs({ volume: 0.5, muted: true, missCue: true });
    expect(values.at(-1)).toBe(0);
    savePrefs({ volume: 0.5, muted: false, missCue: true });
    expect(values.at(-1)).toBe(0.5);
  });
});

describe("the loudness rule", () => {
  // A scripted envelope: loud (-14 dBFS) from 10.0 to 10.8 s, quiet (-30) elsewhere.
  const levelAt = (ms: number) => (ms >= 10000 && ms < 10800 ? -14 : -30);
  const { softGain, lookMs } = loudnessSettings;

  it("a moment on a loud stretch plays on time, softened", () => {
    const [s] = run([{ type: "comboMilestone", count: 25, atMs: 10200 }], { levelAt });
    expect(s).toMatchObject({ sound: "stinger", ms: 10200, gain: softGain });
  });

  it("one whose first lookMs runs into a loud stretch is softened too; one on a quiet stretch plays at full", () => {
    expect(loudnessGain(10000 - lookMs, levelAt)).toBe(softGain);
    expect(loudnessGain(10000 - lookMs - 100, levelAt)).toBe(1);
    const [s] = run([{ type: "feverStart", atMs: 20000 }], { levelAt });
    expect(s).toMatchObject({ sound: "sweep", ms: 20000, gain: 1 });
  });

  it("no recording playing: every moment at full", () => {
    expect(loudnessGain(10200, () => null)).toBe(1);
  });

  it("the envelope is RMS per window in dBFS, channels averaged", () => {
    const rate = 1000; // 100 samples per 100 ms window
    const ch = (f: (i: number) => number) => Float32Array.from({ length: 300 }, (_, i) => f(i));
    const left = ch((i) => (i < 100 ? 0.5 : i < 200 ? (i % 2 ? 0.1 : -0.1) : 0));
    const env = levelEnvelope({
      numberOfChannels: 2,
      sampleRate: rate,
      length: 300,
      getChannelData: (c) => (c ? ch((i) => (i < 100 ? 0.5 : 0)) : left),
    } as AudioBuffer);
    expect(Array.from(env, (d) => Math.round(d * 10) / 10)).toEqual([-6, -26, -120]); // 0.5 → -6.0; 0.1 averaged with 0 → 0.05 → -26.0; silence floors at -120
  });
});

describe("voices", () => {
  it("every voice plays on a context without throwing, and every level is a positive gain", () => {
    const node = (): unknown =>
      new Proxy(() => {}, {
        get: (_, k) =>
          k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : k === "sampleRate" ? 8000 : node(),
        apply: () => node(),
        set: () => true,
      });
    for (const v of Object.keys(voiceSettings.levels) as Voice[]) {
      expect(voiceSettings.levels[v]).toBeGreaterThan(0);
      expect(() =>
        playVoice(node() as AudioContext, node() as AudioNode, v, 1, loudnessSettings.softGain, 100),
      ).not.toThrow();
    }
  });
});
