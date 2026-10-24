// Versus (spec: versus): the chart split at middle C into two players' copies, and each player's tally. Pure.
import type { Chart, GameEvent } from "../../contracts";
import { GOOD_WEIGHT } from "../core/settings";

export const MIDDLE_C = 60;
const LOWEST = 21; // A0
const HIGHEST = 108; // C8

export type Player = "p1" | "p2";
export const playerOfNote = (noteId: string): Player | null => (noteId.startsWith("p1:") ? "p1" : noteId.startsWith("p2:") ? "p2" : null);
export const playerOfPitch = (pitch: number): Player => (pitch >= MIDDLE_C ? "p1" : "p2");

// The right-hand part (all notes for a one-hand chart) twice: P1 by whole octaves as low as it goes with its lowest
// note at or above middle C, P2 that copy moved down by the fewest octaves that put its highest note below middle C.
// null when either copy would leave the 88 keys.
export function versusChart(chart: Chart): Chart | null {
  const right = chart.notes.filter((n) => n.hand === "R");
  const part = right.length && right.length < chart.notes.length ? right : chart.notes;
  if (!part.length) return null;
  const lo = Math.min(...part.map((n) => n.pitch));
  const hi = Math.max(...part.map((n) => n.pitch));
  const up = 12 * Math.ceil((MIDDLE_C - lo) / 12);
  const down = up - 12 * (Math.floor((hi + up - MIDDLE_C) / 12) + 1);
  if (lo + down < LOWEST || hi + up > HIGHEST) return null;
  return {
    ...chart,
    notes: [
      ...part.map((n) => ({ ...n, id: `p1:${n.id}`, pitch: n.pitch + up })),
      ...part.map((n) => ({ ...n, id: `p2:${n.id}`, pitch: n.pitch + down })),
    ],
  };
}

export interface Tally {
  PERFECT: number;
  GREAT: number;
  GOOD: number;
  MISS: number;
  wrong: number;
  extra: number;
  combo: number;
  maxCombo: number;
}
export const emptyTally = (): Tally => ({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0, extra: 0, combo: 0, maxCombo: 0 });

// One event into the two tallies: notes by their id's player, extras and WRONG notes by the half their pitch is in.
export function reduceTallies(t: Record<Player, Tally>, e: GameEvent): Record<Player, Tally> {
  const who = e.type === "noteHit" || e.type === "noteMiss" ? playerOfNote(e.noteId) : e.type === "extra" || e.type === "wrongNote" ? playerOfPitch(e.pitch) : null;
  if (!who) return t;
  const p = { ...t[who] };
  if (e.type === "noteHit") {
    p[e.judgment]++;
    p.combo++;
    p.maxCombo = Math.max(p.maxCombo, p.combo);
  } else if (e.type === "extra") p.extra++;
  else {
    if (e.type === "noteMiss") p.MISS++;
    else p.wrong++;
    p.combo = 0;
  }
  return { ...t, [who]: p };
}

// Results' formula, per player: (PERFECT + 0.5 GREAT + GOOD_WEIGHT GOOD) / (notes judged + WRONG).
export function accuracy(p: Tally): number {
  const judged = p.PERFECT + p.GREAT + p.GOOD + p.MISS;
  return judged ? (p.PERFECT + 0.5 * p.GREAT + GOOD_WEIGHT * p.GOOD) / (judged + p.wrong) : 0;
}

// DRAW when the accuracies match to 0.1%.
export function winner(t: Record<Player, Tally>): "P1 WINS" | "P2 WINS" | "DRAW" {
  const [a, b] = [Math.round(accuracy(t.p1) * 1000), Math.round(accuracy(t.p2) * 1000)];
  return a === b ? "DRAW" : a > b ? "P1 WINS" : "P2 WINS";
}
