import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const probeText = readFileSync(new URL("./probe.js", import.meta.url), "utf8");

interface Probe {
  stats(ms: number[]): { frames: number; p50: number | null; p95: number | null; max: number | null };
  verdict(runs: { frames: number; p95: number | null; invalid?: string }[]): { pass: boolean; invalid: string[] };
  report(): { frames: number; p50: number | null; p95: number | null; max: number | null };
}

// probe.js against a fake window: a fake clock, a rAF queue flushed by hand, the fever gauge and the results screen.
function fake() {
  let now = 0;
  let queue: ((ts: number) => void)[] = [];
  const state = { fever: false, results: false };
  const window = {
    performance: { now: () => now },
    requestAnimationFrame: (cb: (ts: number) => void) => queue.push(cb),
    document: { querySelector: () => (state.results ? {} : null) },
    __pianoArcadeFeverGauge: state,
  } as Record<string, unknown>;
  new Function("window", probeText)(window);
  const raf = window.requestAnimationFrame as (cb: (ts: number) => void) => number;
  // One animation frame at ts: each callback takes its ms on the fake clock.
  const frame = (ts: number, ...ms: number[]) => {
    for (const m of ms) raf(() => (now += m));
    const q = queue;
    queue = [];
    for (const cb of q) cb(ts);
  };
  return { probe: window.__perfProbe as Probe, frame, state };
}

describe("perf budget probe", () => {
  it("takes nearest-rank p50, p95 and max", () => {
    const { probe } = fake();
    const list = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    expect(probe.stats(list)).toEqual({ frames: 20, p50: 10, p95: 19, max: 20 });
    expect(probe.stats([5])).toEqual({ frames: 1, p50: 5, p95: 5, max: 5 });
  });

  it("times a 20 ms callback as 20 ms, and sums two callbacks in one frame into one frame", () => {
    const { probe, frame, state } = fake();
    state.fever = true;
    frame(16, 20);
    frame(32, 3, 4);
    expect(probe.report()).toEqual({ frames: 2, p50: 7, p95: 20, max: 20 });
  });

  it("counts only frames during fever and before the results show", () => {
    const { probe, frame, state } = fake();
    frame(16, 30); // before fever
    state.fever = true;
    frame(32, 5);
    state.results = true;
    frame(48, 40); // behind the results
    state.results = false;
    state.fever = false;
    frame(64, 50); // after fever
    expect(probe.report()).toEqual({ frames: 1, p50: 5, p95: 5, max: 5 });
  });

  it("passes p95 16.7, fails 16.8, and calls a run with no frames invalid", () => {
    const { probe } = fake();
    expect(probe.verdict([{ frames: 100, p95: 16.7 }])).toEqual({ pass: true, invalid: [] });
    expect(probe.verdict([{ frames: 100, p95: 16.7 }, { frames: 100, p95: 16.8 }])).toEqual({ pass: false, invalid: [] });
    expect(probe.verdict([{ frames: 0, p95: null }])).toEqual({ pass: false, invalid: ["run 1: no frames counted"] });
  });
});
