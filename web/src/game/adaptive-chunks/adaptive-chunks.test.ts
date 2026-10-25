import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Take } from "../../contracts";
import { judgeTake } from "../core/judge";
import { botPresses } from "../scenes";
import { scorePhrases, type Phrase } from "../weak-bars";
import { adaptSettings, adaptState, adaptUrl, next, songPhrases, start, takeResult, type AdaptState, type Step, type TakeResult } from "./next";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const fur = song("fur-elise"); // 45 bars of 3/8: 23 phrases
const list = songPhrases(fur, null);

// A scripted player: a function from the window (its phrases) to a take's result. Not Veritas's players (#542).
type Player = (window: Phrase[]) => TakeResult;
const played = (w: Phrase[], accuracy: number, each: (p: Phrase) => number): TakeResult => ({
  accuracy,
  phrases: w.map((p) => ({ from: p.from, accuracy: each(p), notes: p.noteIds.length })),
});
const clean: Player = (w) => played(w, 1, () => 1);

interface Played {
  bars: [number, number];
  length: number;
  pass: boolean;
  step: Step;
  state: AdaptState;
}
// Takes until done, or `takes` of them.
function practice(phraseList: Phrase[], player: Player, takes = 80): Played[] {
  const log: Played[] = [];
  let s = start(phraseList);
  for (let i = 0; i < takes; i++) {
    const w = phraseList.slice(s.from, s.to + 1);
    const r = player(w);
    const { step, state } = next(phraseList, s, r);
    log.push({ bars: [w[0].from, w.at(-1)!.to], length: w.length, pass: r.accuracy >= adaptSettings.passAccuracy, step, state });
    if (step === "done") break;
    s = state;
  }
  return log;
}

describe("adaptive chunks' window rule", () => {
  it("a clean player: take 1 is the whole song, take 2 is done, and nothing shrinks", () => {
    const log = practice(list, clean);
    expect(list).toHaveLength(23);
    expect(log.map((t) => [t.bars, t.step])).toEqual([
      [[1, 45], "again"],
      [[1, 45], "done"],
    ]);
  });

  it("a player who fails only bars 21–28: within 5 takes the window is inside them, then it grows back to done", () => {
    const hard = (p: Phrase) => p.from >= 21 && p.to <= 28;
    const inside = (w: Phrase[]) => w[0].from >= 21 && w.at(-1)!.to <= 28;
    let learned = false; // once the window lies inside bars 21–28, the player has them and plays everything clean
    const log = practice(list, (w) => {
      learned ||= inside(w);
      return learned || !w.some(hard) ? clean(w) : played(w, 0.6, (p) => (hard(p) ? 0.4 : 1));
    });
    const first = log.findIndex((t) => t.bars[0] >= 21 && t.bars[1] <= 28);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(5);
    expect(log.slice(0, first).every((t) => t.step === "smaller")).toBe(true);
    expect(log.at(-1)).toMatchObject({ bars: [1, 45], step: "done" });
  });

  it("a player who manages 6 phrases but not 7: once it converges, it tries only lengths 6 and 7", () => {
    const log = practice(list, (w) => (w.length <= 6 ? clean(w) : played(w, 0.5, () => 0.5)));
    const converged = log.findIndex((t) => t.state.ko === 7);
    expect(converged).toBeGreaterThan(0);
    expect(log.length - converged).toBeGreaterThan(10);
    const after = log.slice(converged + 1);
    expect(new Set(after.map((t) => t.length))).toEqual(new Set([6, 7]));
    expect(after.filter((t) => t.length <= 6 && !t.pass)).toEqual([]);
    expect(log.some((t) => t.step === "done")).toBe(false);
  });

  it("the floor: a fail at one phrase stays at one phrase", () => {
    const log = practice(list, (w) => played(w, 0.3, () => 0.3), 20);
    expect(Math.min(...log.map((t) => t.length))).toBe(1);
    const floor = log.findIndex((t) => t.step === "floor");
    expect(floor).toBeGreaterThan(0);
    expect(log.slice(floor).every((t) => t.step === "floor" && t.length === 1 && t.state.to === t.state.from)).toBe(true);
  });

  it("with hands=L, a phrase with no left-hand notes is skipped and never a window's edge", () => {
    const left = songPhrases(fur, "L");
    expect(list[0].from).toBe(1);
    expect(left[0].from).toBe(3); // bar 1 is the right hand's pickup alone
    expect(left).toHaveLength(22);
    const log = practice(left, (w) => (w.some((p) => p.from === 3) ? played(w, 0.5, (p) => (p.from === 3 ? 0 : 1)) : clean(w)));
    expect(log.every((t) => t.bars[0] >= 3)).toBe(true);
    expect(log.every((t) => left.some((p) => p.from === t.bars[0]) && left.some((p) => p.to === t.bars[1]))).toBe(true);
  });

  it("round-trips a state through its URL, keeping song and hands", () => {
    const params = new URLSearchParams("song=fur-elise&hands=R&mode=wait");
    for (const s of [start(list), { from: 11, to: 13, ok: 3, ko: 6, clean: 1 }, { from: 22, to: 22, ok: 0, ko: 1, clean: 0 }]) {
      const url = adaptUrl(params, list, s);
      const q = new URLSearchParams(url.split("?")[1]);
      expect(adaptState(q, list)).toEqual(s);
      expect(Object.fromEntries(q)).toMatchObject({ song: "fur-elise", hands: "R", tempo: "70", passes: "1", practice: "adapt" });
      expect(q.has("mode")).toBe(false);
    }
    expect(adaptUrl(params, list, start(list))).toContain("from=1&to=45");
    expect(adaptUrl(params, list, start(list), adaptSettings.slowTempo)).toContain("tempo=50");
    expect(adaptState(new URLSearchParams("practice=1&from=1&to=4"), list)).toBeNull();
    expect(adaptState(new URLSearchParams("practice=adapt&from=2&to=4&ok=0&ko=0&clean=0"), list)).toBeNull(); // bar 2 starts no phrase
  });

  it("through the real judge: missing bars 21–28 makes the first shrink pick the half with more of them", () => {
    const bpb = fur.beatsPerBar;
    const kept = fur.notes.filter((n) => !(n.beat >= 20 * bpb && n.beat < 28 * bpb));
    const presses = botPresses({ ...fur, notes: kept }, "perfect");
    const take: Take = {
      chartId: fur.id,
      startedAt: "",
      latencyOffsetMs: 0,
      inputDevice: "test",
      events: presses.map((p) => ({ pitch: p.pitch, velocity: 80, timeMs: p.timeMs, offTimeMs: p.timeMs + p.holdMs })),
    };
    const results = judgeTake(fur, take);
    const r = takeResult(results.accuracy, scorePhrases(fur, take, results), 1);
    expect(r.accuracy).toBeLessThan(adaptSettings.passAccuracy);
    const { step, state } = next(list, start(list), r);
    expect(step).toBe("smaller");
    const half = state.to - state.from + 1;
    const other = state.from === 0 ? [list.length - half, list.length - 1] : [0, half - 1];
    const hardIn = (a: number, b: number) => list.slice(a, b + 1).filter((p) => p.from >= 21 && p.to <= 28).length;
    expect(hardIn(state.from, state.to)).toBeGreaterThan(hardIn(other[0], other[1]));
  });
});
