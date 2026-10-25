// score-follow's scripted players (spike: score-follow-spike), lifted out of follow.test.ts so another feature's
// measurement (record-follows) plays the same seeded takes. Pure: each returns the presses a player makes.
import type { Chart } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { onsetsOf } from "../flow-mode/clock";

export const SEED = 519; // the jitter's seed: issue #519

export interface Press {
  pitch: number;
  wallMs: number;
  onset: number; // index into onsetsOf(chart)
}

// mulberry32: a seeded uniform [0, 1)
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A scripted player: each onset's notes struck at wall(beat) plus a per-press shift. Wall time starts where the
// chart clock does (the first onset's chart ms), as flow-mode's tests drive it.
export function player(chart: Chart, wall: (beat: number, k: number) => number, shift: () => number = () => 0): Press[] {
  const mpb = msPerBeat(chart.bpm);
  return onsetsOf(chart).flatMap((o, k) =>
    o.ids.map((id) => ({ pitch: chart.notes.find((n) => n.id === id)!.pitch, wallMs: wall(o.ms / mpb, k) + shift(), onset: k })),
  );
}

export const span = (chart: Chart) => {
  const beats = onsetsOf(chart).map((o) => o.ms / msPerBeat(chart.bpm));
  return { b0: beats[0], b1: beats[beats.length - 1], n: beats.length };
};

export const PLAYERS: Record<string, (c: Chart) => Press[]> = {
  // every onset at 80% tempo
  steady: (c) => {
    const mpb = msPerBeat(c.bpm);
    const { b0 } = span(c);
    return player(c, (b) => b0 * mpb + ((b - b0) * mpb) / 0.8);
  },
  // tempo moving linearly from 70% to 120% across the song: wall time is the integral of 1 / rate
  drift: (c) => drift(c),
  // the drift, each press shifted by a seeded uniform ±30 ms
  "drift+jitter": (c) => {
    const r = rng(SEED);
    return drift(c, () => (r() * 2 - 1) * 30);
  },
  // steady 80%, with one 3-beat stop before the middle onset
  stop: (c) => {
    const mpb = msPerBeat(c.bpm);
    const { b0, n } = span(c);
    return player(c, (b, k) => b0 * mpb + ((b - b0) * mpb) / 0.8 + (k >= stopAt(n) ? (3 * mpb) / 0.8 : 0));
  },
};
export const stopAt = (n: number) => Math.floor(n / 2);

export function drift(c: Chart, shift?: () => number): Press[] {
  const mpb = msPerBeat(c.bpm);
  const { b0, b1 } = span(c);
  const L = b1 - b0;
  // rate(p) = 0.7 + 0.5p over p = (beat - b0) / L; ∫ db / rate = (L / 0.5) ln(rate / 0.7)
  return player(c, (b) => b0 * mpb + mpb * (L / 0.5) * Math.log((0.7 + (0.5 * (b - b0)) / L) / 0.7), shift);
}
