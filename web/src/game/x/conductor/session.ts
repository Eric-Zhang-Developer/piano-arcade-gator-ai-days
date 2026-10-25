// One conducting session (spike: conductor): camera frames in, MIDI out. The detector finds beats, the clock follows
// them, the scheduler sends the score through the piano ("Portable Grand": the DGX, or laptop-sound's virtual one).
// A still hand holds a fermata, a fist cuts off. Everything is logged in memory for the spec's (b) and (c).
import type { Chart } from "../../../contracts";
import type { Pedal } from "../../pedal";
import { allNotesOff } from "../../piano-out";
import { beatDetector, isFist } from "./beats";
import { clockSettings, conductorClock, type ClockState } from "./clock";
import { scheduler, scoreEvents, velocityFactor } from "./schedule";
import { sampleOf, type Frame, type Point } from "./tracker";

export const sessionSettings = {
  tickMs: 25, // the scheduler's timer, well inside its 100 ms window
  fistFrames: 4, // frames in a row before a fist cuts off, so a passing curl doesn't
  trailMs: 1000, // the baton trail: the wrist's last second
  holdSlackMs: 150, // on top of holdBeats, for the detector's own delay
};

export interface Output {
  send(data: number[], timestamp?: number): void;
  clear?(): void;
}

export interface BeatLog {
  frameMs: number; // performance.now() time of the low point's frame
  mediaMs: number; // the same frame's time in the video (clip mode's labels)
  intervalMs: number | null;
  stroke: number; // hand sizes
}
export interface NoteLog {
  sendMs: number; // the timestamp handed to MIDIOutput.send
  beat: number; // its chart beat
  velocity: number;
}

export type SessionState = ClockState | "cut" | "fin";

export function createSession(chart: Chart, pedal: Pedal | null, out: Output | null) {
  const clock = conductorClock(chart.bpm);
  const detector = beatDetector();
  const events = scoreEvents(chart, pedal);
  const sched = scheduler(events);
  const lastBeat = events.length ? events[events.length - 1].beat : 0;
  const beats: BeatLog[] = [];
  const notes: NoteLog[] = [];
  const trail: (Point & { ms: number })[] = [];
  const sounding = new Map<number, number>(); // pitch -> the note-on's send time
  const pending: { at: number; pitch: number; on: boolean }[] = [];
  const media = new Map<number, number>(); // frame ms -> media ms, the last second's frames
  const frameTimes: number[] = [];
  let factor = 1;
  let fist = 0;
  let cut = false;
  let fin = false;
  let pulseAt = -Infinity;
  let lastBeatMs: number | null = null;
  let landmarks: Point[] | null = null;

  const send = (data: number[], at: number, beat: number) => {
    out?.send(data, at);
    const kind = data[0] & 0xf0;
    if (kind === 0x90) notes.push({ sendMs: at, beat, velocity: data[2] });
    if (kind === 0x90 || kind === 0x80) pending.push({ at, pitch: data[1], on: kind === 0x90 });
  };
  const silence = (now: number) => {
    out?.clear?.(); // drop what's queued in the window
    for (const m of allNotesOff(now)) out?.send(m.bytes, m.atMs);
    out?.send([0xb0, 64, 0], now);
    sounding.clear();
    pending.length = 0;
  };

  const tick = (now: number) => {
    if (fin) return;
    // a hand still for holdBeats (at the current tempo) holds; the sustain stays down
    if (clock.state === "running" && lastBeatMs !== null && clock.rate > 0) {
      const beatMs = 1 / clock.rate;
      if (now - lastBeatMs > clockSettings.holdBeats * beatMs + sessionSettings.holdSlackMs) clock.hold(now);
    }
    sched.fill(now, clock, send, factor);
    pending.sort((a, b) => a.at - b.at);
    while (pending.length && pending[0].at <= now) {
      const p = pending.shift()!;
      if (p.on) sounding.set(p.pitch, p.at);
      else sounding.delete(p.pitch);
    }
    if (sched.done && clock.at(now) > lastBeat + 1) {
      silence(now);
      fin = true;
    }
  };
  const timer = setInterval(() => tick(performance.now()), sessionSettings.tickMs);

  return {
    frame(f: Frame) {
      frameTimes.push(f.ms);
      while (frameTimes.length && frameTimes[0] < f.ms - 1000) frameTimes.shift();
      media.set(f.ms, f.mediaMs);
      for (const k of media.keys()) if (k < f.ms - 1000) media.delete(k);
      landmarks = f.landmarks;
      while (trail.length && trail[0].ms < f.ms - sessionSettings.trailMs) trail.shift();
      if (!f.landmarks || fin) return;
      trail.push({ x: f.landmarks[0].x, y: f.landmarks[0].y, ms: f.ms });
      fist = isFist(f.landmarks) ? fist + 1 : 0;
      if (fist === sessionSettings.fistFrames && clock.state !== "prep") {
        silence(f.ms);
        clock.cut(f.ms);
        cut = true;
        lastBeatMs = null;
        return;
      }
      if (fist) return; // a fist conducts nothing
      const b = detector.push(sampleOf(f.landmarks, f.ms));
      if (!b) return;
      beats.push({ frameMs: b.t, mediaMs: media.get(b.t) ?? NaN, intervalMs: lastBeatMs === null ? null : b.t - lastBeatMs, stroke: b.stroke });
      clock.beat(b.t);
      if (clock.state === "running") cut = false;
      factor = velocityFactor(b.stroke);
      lastBeatMs = b.t;
      pulseAt = performance.now();
    },
    // The conducted chart time in ms, for the highway.
    nowMs: (now: number) => clock.at(now) * (60000 / chart.bpm),
    get state(): SessionState {
      return fin ? "fin" : cut && clock.state === "prep" ? "cut" : clock.state;
    },
    get bpm() {
      return clock.state === "prep" ? null : clock.tempoRatio * chart.bpm;
    },
    get ratio() {
      return clock.state === "prep" ? null : clock.tempoRatio;
    },
    get factor() {
      return factor;
    },
    get fps() {
      return frameTimes.length > 1 ? ((frameTimes.length - 1) * 1000) / (frameTimes[frameTimes.length - 1] - frameTimes[0]) : null;
    },
    pulseAt: () => pulseAt,
    pressed: () => new Set(sounding.keys()),
    trail: () => trail,
    landmarks: () => landmarks,
    log: () => ({ song: chart.id, bpm: chart.bpm, beats, notes }),
    stop() {
      clearInterval(timer);
      silence(performance.now());
      fin = true;
    },
  };
}

export type Session = ReturnType<typeof createSession>;
