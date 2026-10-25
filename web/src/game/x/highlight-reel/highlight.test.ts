import { describe, expect, it } from "vitest";
import type { Chart, Judgment, Results, Take } from "../../../contracts";
import { msPerBeat } from "../../core/settings";
import { bestRun, cut, expectedOnsetsMs, highlightSettings as S, reelMsOf, slowRateAt, slowSourceFrames, takeTimeAt, type Edl } from "./cut";
import { detectOnsets, matchOnsets } from "./onsets";

// A synthetic chart: n quarter notes at 120 bpm, pitches cycling, no song's notes.
function chartOf(n: number, bpm = 120): Chart {
  return {
    id: "synthetic",
    title: "Synthetic",
    composer: "Test",
    source: "test",
    bpm,
    beatsPerBar: 4,
    notes: Array.from({ length: n }, (_, i) => ({ id: `n${i}`, pitch: 60 + (i % 5), beat: i, duration: 1, hand: "R" as const })),
  };
}
// A take that hits every note on time, judged by a pattern (P, G, D for GOOD, M for MISS).
function takeOf(chart: Chart, pattern: string): { take: Take; results: Results } {
  const mpb = msPerBeat(chart.bpm);
  const J: Record<string, Judgment> = { P: "PERFECT", G: "GREAT", D: "GOOD", M: "MISS" };
  const events = chart.notes
    .filter((_, i) => pattern[i] !== "M")
    .map((n) => ({ pitch: n.pitch, velocity: 80, timeMs: n.beat * mpb, offTimeMs: n.beat * mpb + mpb / 2 }));
  let e = 0;
  const judgments = chart.notes.map((n, i) => ({ noteId: n.id, judgment: J[pattern[i]], offsetMs: pattern[i] === "M" ? null : 0, eventIndex: pattern[i] === "M" ? null : e++ }));
  const take: Take = { chartId: chart.id, startedAt: "2026-10-25T00:00:00Z", latencyOffsetMs: 0, inputDevice: "test", events };
  const results = { chartId: chart.id, judgments, extras: [], counts: { PERFECT: 0, GREAT: 0, MISS: 0, extra: 0 }, accuracy: 1, maxCombo: 0, rank: "S" } as Results;
  return { take, results };
}
const fms = 1000 / S.fps;

describe("best run (highlight-reel)", () => {
  it("is the longest PERFECT run", () => {
    const c = chartOf(12);
    const r = bestRun(c, takeOf(c, "PPGPPPPGPPPG").results)!;
    expect(r).toMatchObject({ count: 4, kind: "PERFECT", fromMs: 3 * 500, toMs: 6 * 500 });
  });
  it("takes the earliest on a tie", () => {
    const c = chartOf(9);
    expect(bestRun(c, takeOf(c, "PPPGPPPGP").results)).toMatchObject({ count: 3, fromMs: 0 });
  });
  it("falls back to the longest run of hits with no PERFECT", () => {
    const c = chartOf(8);
    expect(bestRun(c, takeOf(c, "GDMGGGDM").results)).toMatchObject({ count: 4, kind: "hits", fromMs: 3 * 500 });
  });
  it("makes no reel with no hits", () => {
    const c = chartOf(4);
    const { take, results } = takeOf(c, "MMMM");
    expect(bestRun(c, results)).toBeNull();
    expect(cut(c, take, results)).toBeNull();
  });
});

describe("the cut (highlight-reel)", () => {
  // 60 notes at 120 bpm: a 30 s take, best run notes 10–39 (15 s of PERFECT), the rest GREAT.
  const c = chartOf(60);
  const { take, results } = takeOf(c, "G".repeat(10) + "P".repeat(30) + "G".repeat(20));
  const edl = cut(c, take, results)! as Edl;
  const [slow, finish, title] = edl.segments;

  it("is exactly 900 frames, the title card exactly 90", () => {
    expect(slow.frames + finish.frames + title.frames).toBe(900);
    expect(title.frames).toBe(90);
    expect(title.fromFrame).toBe(810);
    expect(finish.fromFrame).toBe(slow.frames);
  });
  it("keeps the cold open inside the best run ± one beat, and the finish apart from it", () => {
    expect(slow.srcFromMs).toBeGreaterThanOrEqual(edl.run.fromMs - 500);
    expect(slow.srcToMs).toBeLessThanOrEqual(edl.run.toMs + 500);
    expect(finish.srcFromMs).toBeGreaterThanOrEqual(slow.srcToMs);
  });
  it("ends the finish a beat after the last release", () => {
    expect(finish.srcToMs).toBeCloseTo(59 * 500 + 250 + 500);
  });
  it("holds 0.5× and never goes below it", () => {
    expect(slowRateAt(S.slowFrames / 2)).toBe(0.5);
    for (let f = 0; f < S.slowFrames; f += 0.5) expect(slowRateAt(f)).toBeGreaterThanOrEqual(0.5);
    expect(slowRateAt(0)).toBe(1);
    expect(slowRateAt(S.slowFrames)).toBe(1);
  });
  it("maps reel to take time monotonically within each segment, and the integral matches the rate", () => {
    for (const g of [slow, finish]) {
      let prev = -Infinity;
      for (let n = g.fromFrame; n < g.fromFrame + g.frames; n++) {
        const t = takeTimeAt(edl, n);
        expect(t).toBeGreaterThan(prev);
        prev = t;
      }
    }
    const f = 123;
    expect(slowSourceFrames(f + 0.001) - slowSourceFrames(f)).toBeCloseTo(slowRateAt(f) * 0.001, 6);
  });
  it("pads a run too short to fill the cold open, centered on it, and takes a run reaching the finish early", () => {
    const short = takeOf(c, "G".repeat(20) + "PPP" + "G".repeat(37));
    const e = cut(c, short.take, short.results)!;
    const mid = (e.run.fromMs + e.run.toMs) / 2;
    expect((e.segments[0].srcFromMs + e.segments[0].srcToMs) / 2).toBeCloseTo(mid);
    const late = takeOf(c, "G".repeat(30) + "P".repeat(30));
    const l = cut(c, late.take, late.results)!;
    expect(l.segments[0].srcToMs).toBeLessThanOrEqual(l.segments[1].srcFromMs + 1e-9);
    expect(l.segments[0].srcFromMs).toBeGreaterThanOrEqual(l.run.fromMs - 500);
  });
});

describe("onsets through the edit list (highlight-reel)", () => {
  it("map each press to its reel time through a hand-built edit list", () => {
    const edl: Edl = {
      run: { count: 1, kind: "PERFECT", fromMs: 0, toMs: 0 },
      segments: [
        { kind: "slow", fromFrame: 0, frames: S.slowFrames, srcFromMs: 1000, srcToMs: 1000 + slowSourceFrames(S.slowFrames) * fms },
        { kind: "finish", fromFrame: S.slowFrames, frames: 270, srcFromMs: 20000, srcToMs: 24500 },
        { kind: "title", fromFrame: 810, frames: 90, srcFromMs: 24500, srcToMs: 24500 },
      ],
    };
    // 1000 ms: the cold open's first frame; 20000: the finish's first; 21000: a second into the finish (1×)
    const ev = (timeMs: number) => ({ pitch: 60, velocity: 80, timeMs, offTimeMs: timeMs + 100 });
    const take = { events: [ev(1000), ev(500), ev(20000), ev(21000), ev(30000)] } as Take;
    const got = expectedOnsetsMs(edl, take);
    expect(got).toHaveLength(3);
    expect(got[0]).toBeCloseTo(0, 3);
    expect(got[1]).toBeCloseTo(9000, 3);
    expect(got[2]).toBeCloseTo(10000, 3);
    // in the hold, take time runs at half speed: 100 ms of take is 200 ms of reel
    const holdStart = 1000 + slowSourceFrames(S.rampFrames) * fms;
    expect(reelMsOf(edl, holdStart + 100)! - reelMsOf(edl, holdStart)!).toBeCloseTo(200, 2);
  });
});

describe("the onset detector (highlight-reel)", () => {
  it("finds every click of a synthetic signal within 1 ms", () => {
    const rate = 48000;
    const x = new Float32Array(rate * 3);
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 1e-4;
    for (let i = 0; i < x.length; i++) x[i] = noise();
    const clicks = [100, 250.5, 400, 1033.3, 1500, 1540, 2222.2, 2900];
    for (const t of clicks) {
      const at = Math.round((t / 1000) * rate);
      for (let k = 0; k < 2400; k++) x[at + k] += 0.5 * Math.exp(-k / 400) * Math.sin(k * 0.3 + 1.2);
    }
    const found = detectOnsets(x, rate);
    expect(found).toHaveLength(clicks.length);
    found.forEach((t, i) => expect(Math.abs(t - clicks[i])).toBeLessThanOrEqual(1));
    expect(matchOnsets(clicks, found)).toMatchObject({ expected: clicks.length, matched: clicks.length });
  });
});
