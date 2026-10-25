import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import type { HandsSetting } from "../hand-mode/hands";
import { onsetsOf } from "./clock";
import { FlowJudge } from "./judge";
import { headline, steadiness } from "./steady";

const song = (id: string): Chart => JSON.parse(readFileSync(`public/songs/${id}/chart.json`, "utf8"));
const twinkle = song("twinkle");
const furElise = song("fur-elise");

interface Press {
  pitch: number;
  wallMs: number;
}

// A scripted player: the judged notes' onsets, each struck at the wall time `at` gives (from the onset's index and
// beat, in wall ms). Every note of an onset is struck together.
function player(chart: Chart, at: (k: number, beat: number) => number, skip: (k: number) => boolean = () => false): Press[] {
  const mpb = msPerBeat(chart.bpm);
  const onsets = onsetsOf(chart);
  return onsets.flatMap((o, k) =>
    skip(k) ? [] : o.ids.map((id) => ({ pitch: chart.notes.find((n) => n.id === id)!.pitch, wallMs: at(k, o.ms / mpb) })),
  );
}

// Steady at a fraction r of the chart's tempo, from the first onset; `pause(k)` adds wall ms before onset k.
function steadyPlayer(chart: Chart, r: number, pause: (k: number) => number = () => 0): Press[] {
  const mpb = msPerBeat(chart.bpm);
  const b0 = onsetsOf(chart)[0].ms / mpb;
  let extra = 0;
  return player(chart, (k, beat) => {
    extra += pause(k);
    return b0 * mpb + ((beat - b0) * mpb) / r + extra;
  });
}

// The page's loop in miniature: presses at their wall times, then the clock's update and the judge's advance each
// 16 ms frame, from 2 beats before the first note. onFrame sees each frame.
function run(chart: Chart, presses: Press[], opts: { hands?: HandsSetting; startRate?: number; tailMs?: number } = {}, onFrame?: (outer: number, j: FlowJudge) => void) {
  const events: GameEvent[] = [];
  const judge = new FlowJudge(chart, (e) => events.push(e), { hands: opts.hands, startRate: opts.startRate });
  const mpb = msPerBeat(chart.bpm);
  const sorted = [...presses].sort((a, b) => a.wallMs - b.wallMs);
  const start = onsetsOf(chart)[0].ms - 2 * mpb;
  const end = (sorted.length ? sorted[sorted.length - 1].wallMs : start) + (opts.tailMs ?? 2 * mpb);
  let k = 0;
  for (let t = start; t <= end; t += 16) {
    for (; k < sorted.length && sorted[k].wallMs <= t; k++) judge.press(sorted[k].pitch, judge.clock.now(sorted[k].wallMs), k, sorted[k].wallMs);
    judge.clock.update(t);
    judge.advance(judge.clock.now(t));
    onFrame?.(t, judge);
  }
  return { judge, events, results: judge.finish(judge.clock.now(end)) };
}

const misses = (events: GameEvent[]) => events.filter((e) => e.type === "noteMiss");
const breaks = (events: GameEvent[]) => events.filter((e) => e.type === "combo" && e.count === 0);

describe.each([
  ["Twinkle", twinkle],
  ["Für Elise", furElise],
])("flow mode on %s", (_, chart) => {
  it("steady at 80%: every note PERFECT, rate settles at 0.80 ± 0.03, and the word is steady", () => {
    const { judge, results } = run(chart, steadyPlayer(chart, 0.8));
    expect(results.counts.PERFECT).toBe(chart.notes.length);
    expect(judge.clock.rate).toBeGreaterThan(0.77);
    expect(judge.clock.rate).toBeLessThan(0.83);
    expect(steadiness(judge.deviations)).toBe("steady");
  });

  it("drifting from 70% to 120% across the song: no MISS at any point", () => {
    const n = onsetsOf(chart).length;
    const mpb = msPerBeat(chart.bpm);
    let wall = onsetsOf(chart)[0].ms;
    let prevBeat = onsetsOf(chart)[0].ms / mpb;
    const presses = player(chart, (k, beat) => {
      wall += ((beat - prevBeat) * mpb) / (0.7 + (0.5 * k) / (n - 1));
      prevBeat = beat;
      return wall;
    });
    const { events, results } = run(chart, presses);
    expect(misses(events)).toHaveLength(0);
    expect(results.counts.MISS).toBe(0);
  });

  it("the clock never passes an unplayed note: no presses, 10 s sampled every 16 ms", () => {
    const first = onsetsOf(chart)[0].ms;
    let max = -Infinity;
    let holding = false; // at the last frame, before run's finish() marks every note MISS
    let slips = -1;
    run(chart, [], { tailMs: 10_000 }, (t, j) => {
      max = Math.max(max, j.clock.now(t));
      holding = j.clock.holding;
      slips = j.slips;
    });
    expect(max).toBeLessThanOrEqual(first);
    expect(holding).toBe(true);
    expect(slips).toBe(0); // waiting before the first note isn't a slip
  });

  it("it catches up: each played onset is reached within half a beat, and no frame jumps a beat", () => {
    const mpb = msPerBeat(chart.bpm);
    const b0 = onsetsOf(chart)[0].ms;
    // A steady 200% player outruns the clock's 1.3 cap: only catching up keeps the clock with them. The rate only
    // rises from 1.0, so half a beat at 1.0 bounds each deadline.
    const due = onsetsOf(chart).map((o) => ({ ms: o.ms, by: b0 + (o.ms - b0) / 2 + (0.5 * mpb) / 1 + 16 }));
    const late: number[] = [];
    let prev: number | null = null;
    let maxStep = 0;
    run(chart, steadyPlayer(chart, 2), {}, (t, j) => {
      const now = j.clock.now(t);
      if (prev !== null) maxStep = Math.max(maxStep, now - prev);
      prev = now;
      for (const d of due) if (d.by > t - 16 && d.by <= t && now < d.ms - 1e-6) late.push(d.ms);
    });
    expect(late).toEqual([]);
    expect(maxStep).toBeLessThan(mpb);
  });

  it("the cap: a player at 200% leaves rate at 1.3", () => {
    const { judge } = run(chart, steadyPlayer(chart, 2));
    expect(judge.clock.rate).toBeCloseTo(1.3, 6);
  });
});

describe("flow mode's slips", () => {
  const mpb = msPerBeat(twinkle.bpm);
  const onsets = onsetsOf(twinkle);
  const noteAt = (k: number) => twinkle.notes.find((n) => n.id === onsets[k].ids[0])!;

  it("one wrong pitch: a WRONG, the combo breaks, and that note still waits", () => {
    const presses = steadyPlayer(twinkle, 1);
    const wrongAt = (presses[5].wallMs + presses[6].wallMs) / 2;
    let waiting: boolean | null = null;
    const { judge, events, results } = run(twinkle, [...presses, { pitch: 30, wallMs: wrongAt }], {}, (t, j) => {
      if (waiting === null && t >= wrongAt) waiting = !j.noteState.has(noteAt(6).id);
    });
    expect(results.counts.wrong).toBe(1);
    expect(events.filter((e) => e.type === "wrongNote")).toHaveLength(1);
    expect(waiting).toBe(true);
    expect(results.judgments.find((j) => j.noteId === noteAt(6).id)!.judgment).not.toBe("MISS");
    expect(results.counts.MISS).toBe(0);
    expect(judge.slips).toBe(1);
  });

  it("one skipped note (a later note played first): that note is a MISS", () => {
    const k = onsets.findIndex((_, i) => i > 3 && noteAt(i).pitch !== noteAt(i + 1).pitch);
    const { judge, results } = run(twinkle, player(twinkle, (_, beat) => beat * mpb, (i) => i === k));
    expect(results.judgments.find((j) => j.noteId === noteAt(k).id)!.judgment).toBe("MISS");
    expect(results.counts.MISS).toBe(1);
    expect(judge.slips).toBe(1);
  });

  it("a 3-beat stop mid-song: the combo breaks once, a slip counts, and the take still completes", () => {
    const { judge, events, results } = run(twinkle, steadyPlayer(twinkle, 1, (k) => (k === 20 ? 3 * mpb : 0)));
    expect(judge.lost).toBe(1);
    expect(judge.slips).toBe(1);
    expect(breaks(events)).toHaveLength(1);
    expect(results.counts.MISS).toBe(0);
  });

  it("a 1.5-beat stop: the combo holds", () => {
    const { judge, results } = run(twinkle, steadyPlayer(twinkle, 1, (k) => (k === 20 ? 1.5 * mpb : 0)));
    expect(judge.lost).toBe(0);
    expect(results.maxCombo).toBe(twinkle.notes.length);
  });

  it("a 3-note chord with its inner note missing: that note is GOOD and the combo holds", () => {
    const n = (id: string, pitch: number, beat: number) => ({ id, pitch, beat, duration: 1, hand: "R" as const });
    const chart: Chart = { ...twinkle, id: "chord", notes: [n("a", 60, 0), n("lo", 60, 1), n("mid", 64, 1), n("hi", 67, 1), n("b", 72, 2), n("c", 74, 3)] };
    const presses = steadyPlayer(chart, 1).filter((p, i) => !(i === 2 && p.pitch === 64));
    const { events, results } = run(chart, presses);
    expect(results.judgments.find((j) => j.noteId === "mid")!.judgment).toBe("GOOD");
    expect(results.counts.MISS).toBe(0);
    expect(breaks(events)).toHaveLength(0);
    expect(results.maxCombo).toBe(6);
  });

  it("hands=R: left-hand notes never hold the clock", () => {
    const right = { ...furElise, notes: furElise.notes.filter((x) => x.hand === "R") };
    const rightAt = new Set(onsetsOf(right).map((o) => o.ms));
    const heldAt = new Set<number>();
    const { results } = run(furElise, steadyPlayer(right, 1), { hands: "R" }, (t, j) => {
      if (j.clock.holding) heldAt.add(j.clock.now(t));
    });
    expect([...heldAt].every((ms) => rightAt.has(ms))).toBe(true);
    expect(results.judgments).toHaveLength(right.notes.length);
    expect(results.counts.MISS).toBe(0);
  });
});

describe("steadiness", () => {
  it("steady, rushed, uneven", () => {
    expect(steadiness([0.02, -0.05, 0.08, 0])).toBe("steady");
    expect(steadiness([-0.3, -0.25, -0.2, 0.05])).toBe("a bit rushed");
    expect(steadiness([0.3, -0.25, 0.2, -0.15])).toBe("a bit uneven");
    expect(steadiness([])).toBe("steady");
  });

  it("the headline: right notes, the word, the slips", () => {
    const { judge, results } = run(twinkle, steadyPlayer(twinkle, 1));
    expect(headline(results, judge.slips, judge.deviations, judge.heldTempo)).toBe("Steady at 100% of tempo · 100% right notes · 0 slips");
    const k = 10;
    const skip = run(twinkle, player(twinkle, (_, beat) => beat * msPerBeat(twinkle.bpm), (i) => i === k));
    expect(headline(skip.results, skip.judge.slips, skip.judge.deviations)).toBe(`Steady · ${Math.round((100 * 41) / 42)}% right notes · 1 slip`);
  });
});
