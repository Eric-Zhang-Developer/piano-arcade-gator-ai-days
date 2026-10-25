// Play Moonlight (spec: inside): moonlight-1's chart with its velocities and its pedal file, as roll-time sends to the
// DGX. The same list drives the action, so each strike lands on its note's send time.
import type { Chart } from "../../../contracts";
import { msPerBeat } from "../../core/settings";
import { pedalEvents, type Pedal } from "../../pedal";
import { sendsBetween, type Send } from "../composers-hands/rolls";

export const SONG = "moonlight-1";
export const LEAD_MS = 600; // from Play to the first note: time for the first approach to be drawn

export interface Schedule {
  notes: { pitch: number; onMs: number; offMs: number; velocity: number }[];
  pedal: { atMs: number; down: boolean }[];
  endMs: number;
}

export function schedule(chart: Chart, pedal: Pedal | null): Schedule {
  const mpb = msPerBeat(chart.bpm);
  const notes = chart.notes
    .map((n) => ({ pitch: n.pitch, onMs: n.beat * mpb, offMs: (n.beat + n.duration) * mpb, velocity: n.velocity ?? 64 }))
    .sort((a, b) => a.onMs - b.onMs);
  const pedals = pedal ? pedalEvents(pedal, mpb).map((e) => ({ atMs: e.atMs, down: e.value === 127 })) : [];
  return { notes, pedal: pedals, endMs: Math.max(0, ...notes.map((n) => n.offMs), ...pedals.map((p) => p.atMs)) };
}

export const sendsIn = (s: Schedule, fromMs: number, toMs: number): Send[] => sendsBetween(s.notes, s.pedal, fromMs, toMs);
