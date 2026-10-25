// Conductor's scheduler (spike: conductor), "a tale of two clocks": a short timer wakes and sends every note-on,
// note-off and pedal event that falls inside the next lookahead window of conducted time, with its timestamp. The
// window is short, so a tempo change or a hold takes effect within it. Each event is sent once, never in the past.
import type { Chart } from "../../../contracts";
import type { Pedal } from "../../pedal";

export const scheduleSettings = {
  lookaheadMs: 100, // logged in decisions/conductor-thresholds
  channel: 0,
};

// Dynamics: a stroke's depth in hand sizes scales each note's own chart velocity, so the score's shape stays and a big
// swing swells it. A stroke of `refStroke` plays the chart as written (decisions/conductor-thresholds).
export const dynamicsSettings = { refStroke: 2, minFactor: 0.5, maxFactor: 1.6 };
export const velocityFactor = (stroke: number, s = dynamicsSettings) =>
  Math.min(s.maxFactor, Math.max(s.minFactor, stroke / s.refStroke));

export interface ScoreEvent {
  beat: number;
  data: number[];
  kind: "on" | "off" | "pedal";
}

// The chart's notes (each held its written length in conducted time) and the pedal (pedal.json's [down, up] pairs),
// by beat. At the same beat offs and pedal-ups go first, then pedal-downs, then ons: a re-pedal catches the new notes.
export function scoreEvents(chart: Chart, pedal: Pedal | null = null): ScoreEvent[] {
  const ch = scheduleSettings.channel;
  const ev: ScoreEvent[] = [];
  for (const n of chart.notes) {
    ev.push({ beat: n.beat, data: [0x90 | ch, n.pitch, n.velocity ?? 80], kind: "on" });
    ev.push({ beat: n.beat + n.duration, data: [0x80 | ch, n.pitch, 0], kind: "off" });
  }
  for (const [down, up] of pedal ?? []) {
    ev.push({ beat: down, data: [0xb0 | ch, 64, 127], kind: "pedal" });
    ev.push({ beat: up, data: [0xb0 | ch, 64, 0], kind: "pedal" });
  }
  const order = (e: ScoreEvent) => (e.kind === "on" ? 2 : e.kind === "pedal" && e.data[2] > 0 ? 1 : 0);
  return ev.sort((a, b) => a.beat - b.beat || order(a) - order(b));
}

export interface ClockView {
  at(now: number): number;
  peek(later: number): number;
  readonly rate: number; // chart beats per ms
}

// fromBeat: events before it never sound (a restart). velocity: the dynamics factor on a note-on's own velocity.
export function scheduler(events: readonly ScoreEvent[], fromBeat = -Infinity) {
  let i = 0;
  const skipTo = (beat: number) => {
    while (i < events.length && events[i].beat < beat - 1e-9) i++;
  };
  skipTo(fromBeat);
  return {
    skipTo,
    fill(now: number, clock: ClockView, send: (data: number[], atMs: number, beat: number) => void, velocity = 1) {
      const pos = clock.at(now);
      const end = clock.peek(now + scheduleSettings.lookaheadMs);
      const rate = clock.rate;
      for (; i < events.length && events[i].beat < end; i++) {
        const e = events[i];
        const at = rate > 0 ? Math.max(now, now + (e.beat - pos) / rate) : now;
        const data = e.kind === "on" ? [e.data[0], e.data[1], Math.min(127, Math.max(1, Math.round(e.data[2] * velocity)))] : e.data;
        send(data, at, e.beat);
      }
    },
    get done() {
      return i >= events.length;
    },
  };
}
