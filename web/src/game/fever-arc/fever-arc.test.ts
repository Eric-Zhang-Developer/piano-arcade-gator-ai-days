import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { flashAt, momentSettings } from "../fever-moment";
import { shimmerAt } from "../fever-gauge";
import { landingSettings } from "../results-landing";
import { type ArcState, arcAt, arcSettings, emptyArc, feverArc, ignitionFor, nextBeat, reduceArc } from ".";

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

  it("under results-landing the handoff follows the landing's own timeline, not the stalled chart clock (#1333)", () => {
    // The out: the drawn clock eases to a stop near T0 (20 000), and songEnd comes at the mount, later on the real clock.
    const drawn = (ms: number) => 20_000 + Math.min(ms, landingSettings.outMs) / 3;
    expect(arcAt(filled, drawn(0), 0)).toMatchObject({ phase: "handoff", heat: 1 });
    expect(arcAt(filled, drawn(200), 200).heat).toBeCloseTo(0.5, 6);
    expect(arcAt(filled, drawn(landingSettings.outMs), landingSettings.outMs).heat).toBe(0);
    // The last frame behind the results is drawn at the out's clock, before songEnd's time: still drained.
    const ended = reduceArc(filled, { type: "songEnd", atMs: 20_400 } as GameEvent);
    expect(arcAt(ended, drawn(landingSettings.outMs), landingSettings.outMs)).toMatchObject({ phase: "handoff", heat: 0 });
    // Without the landing, the frozen frame #1333 reported: sustain until songEnd.
    expect(arcAt(filled, drawn(landingSettings.outMs)).phase).toBe("sustain");
    // A break before T0 keeps its own release; a take that never lit has nothing to hand off.
    expect(arcAt(brk(filled, 19_900), 20_000, 100).phase).toBe("release");
    expect(arcAt(run(eleven), 20_000, 100).phase).toBe("build");
  });

  it("leaves the chart as it found it, so judging can't move", () => {
    const chart = { notes: Array(42).fill({}), bpm: 100 } as never;
    expect(feverArc().transformChart!(chart, new URLSearchParams())).toBe(chart);
  });
});

describe("ignitionFor", () => {
  it("follows the take's tempo: the beat after feverStart, for the sweep to start on once sound/ is free (#600)", () => {
    const p = feverArc();
    p.transformChart!({ notes: Array(42).fill({}), bpm: 100 } as never, new URLSearchParams());
    expect(ignitionFor(6100)).toBe(6600); // 100 BPM: 600 ms beats
  });
});

describe("reduced motion", () => {
  it("cuts: no shimmer in the build, which still shows it with motion on", () => {
    const build = arcAt(run(Array(11).fill(hit)), 1000);
    expect(shimmerAt(build, true)).toBeNull();
    expect(shimmerAt(build, false)).not.toBeNull();
    expect(flashAt(0)).toBe(0); // the flash still starts dark, then peaks fast: momentSettings.peakMs
  });
});
