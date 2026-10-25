import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { momentSettings } from "../fever-moment";
import { soundsFor } from "../sound";
import { type ArcState, arcAt, arcSettings, emptyArc, feverArc, ignitionFor, nextBeat, reduceArc, towardAmber } from ".";

const hit: GameEvent = { type: "noteHit", noteId: "n", pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: 0 };
const run = (events: GameEvent[], s: ArcState = emptyArc(42, 120)) => events.reduce(reduceArc, s);
// A combo break as the judge sends it: the miss (which empties the gauge), then feverEnd.
const brk = (s: ArcState, atMs: number) => run([{ type: "noteMiss", noteId: "m", pitch: 60, atMs }, { type: "feverEnd", atMs }], s);

describe("the beat grid", () => {
  it("ignites on the next beat at 60, 100 and 180 BPM, at most one beat later", () => {
    for (const bpm of [60, 100, 180]) {
      const beat = msPerBeat(bpm);
      for (const at of [1, 1234.5, 9999]) {
        const b = nextBeat(at, beat);
        expect(b).toBeGreaterThanOrEqual(at);
        expect(b - at).toBeLessThan(beat);
        expect((b / beat) % 1).toBeCloseTo(0, 6);
      }
    }
  });

  it("a feverStart exactly on a beat ignites on that beat", () => {
    expect(nextBeat(2000, 500)).toBe(2000);
    expect(nextBeat(600 * 3, 600)).toBe(1800);
    expect(nextBeat(0, 500)).toBe(0);
  });
});

describe("the arc", () => {
  const eleven = Array(11).fill(hit);
  const filled = run([{ type: "songStart", atMs: 0 }, ...Array(12).fill(hit), { type: "feverStart", atMs: 6100 }]);

  it("goes idle → build → ignite → sustain → release, in order", () => {
    expect(arcAt(run(Array(5).fill(hit)), 1000).phase).toBe("idle");
    const build = arcAt(run(eleven), 1000);
    expect(build.phase).toBe("build");
    expect(build.progress).toBeGreaterThan(0);
    expect(filled.igniteAtMs).toBe(6500); // 120 BPM: the beat after 6100
    expect(arcAt(filled, 6300)).toMatchObject({ phase: "build", progress: 1, heat: 0 }); // held at its peak until the drop
    expect(arcAt(filled, 6500)).toMatchObject({ phase: "ignite", heat: 1 });
    expect(arcAt(filled, 6500 + momentSettings.totalMs).phase).toBe("sustain");
    const broke = brk(filled, 10_000);
    expect(arcAt(broke, 10_000 + arcSettings.releaseMs / 2).phase).toBe("release");
    expect(arcAt(broke, 10_000 + arcSettings.releaseMs / 2).heat).toBeCloseTo(0.5, 6);
    expect(arcAt(broke, 10_000 + arcSettings.releaseMs).phase).toBe("idle");
  });

  it("releases over about 400 ms", () => {
    expect(arcSettings.releaseMs).toBe(400);
    const broke = brk(filled, 10_000);
    expect(arcAt(broke, 10_399).heat).toBeGreaterThan(0);
    expect(arcAt(broke, 10_400).heat).toBe(0);
  });

  it("a break before the ignition beat never lights anything", () => {
    const early = brk(filled, 6200);
    expect(arcAt(early, 6200).phase).toBe("idle");
    expect(arcAt(early, 6600).phase).toBe("idle");
  });

  it("a song ending in fever hands off on results-landing's out", () => {
    const ended = reduceArc(filled, { type: "songEnd", atMs: 20_000 } as GameEvent);
    expect(arcAt(ended, 20_000 + arcSettings.handoffMs / 2)).toMatchObject({ phase: "handoff" });
    expect(arcAt(ended, 20_000 + arcSettings.handoffMs).heat).toBe(0);
  });

  it("leaves the chart as it found it, so judging can't move", () => {
    const chart = { notes: Array(42).fill({}), bpm: 100 } as never;
    expect(feverArc().transformChart!(chart, new URLSearchParams())).toBe(chart);
  });
});

describe("the sweep", () => {
  it("starts on the ignition beat, not at feverStart", () => {
    const p = feverArc();
    p.transformChart!({ notes: Array(42).fill({}), bpm: 100 } as never, new URLSearchParams());
    const [s] = soundsFor([{ type: "feverStart", atMs: 6100 }], 0);
    expect(ignitionFor(6100)).toBe(6600); // 100 BPM: 600 ms beats
    expect(s).toEqual({ sound: "sweep", startTime: 6.6 });
  });
});

describe("toward amber", () => {
  it("moves a hue part way to fever's amber, keeps grey grey, and leaves k = 0 alone", () => {
    const blue = [70, 130, 255];
    expect(towardAmber(blue, 0)).toEqual(blue);
    expect(towardAmber([128, 128, 128], 0.5)).toEqual([128, 128, 128]);
    const all = towardAmber(blue, 1);
    expect(all[0]).toBeGreaterThan(all[1]);
    expect(all[1]).toBeGreaterThan(all[2]); // amber: red > green > blue
    const unit = towardAmber([70 / 255, 130 / 255, 1], 1);
    unit.forEach((v, i) => expect(v * 255).toBeCloseTo(all[i], 6));
  });
});
