// Score follow (spike: score-follow-spike): a bass-and-drums band on its own clock that predicts your next note from
// your tempo, instead of waiting for it as flow mode's clock does. Pure: the plugin (index.ts) and the measurement
// (follow.test.ts) run this same code. Times are wall ms (performance.now()), positions chart beats.
import type { Chart } from "../../contracts";
import { beatHits, beatSettings, endBeat } from "../beat";
import { msPerBeat } from "../core/settings";
import { flowSettings } from "../flow-mode/clock";

export const followSettings = {
  waitBeats: 0.5, // when you stop, the band plays this far past your next note, then waits for it
  lookaheadMs: 300, // events are queued this far ahead with send(data, timestamp), as beat-track does
  bassChannel: 1, // MIDI channel 2 (0-based here); never channel 1, which is the player's
  drumChannel: 9, // channel 10
  bassProgram: 32, // GM 33, Acoustic Bass (0-based)
  bassVelocity: 70,
  bassOctaves: 2, // each bar's first chart note, this many octaves down
};

const clampRate = (r: number) => Math.min(flowSettings.maxRate, Math.max(flowSettings.minRate, r));

export interface BandEvent {
  beat: number;
  data: number[];
  offAfterMs?: number; // a drum hit's note-off, this long after its note-on (beat-track's length)
}

// The band, generated from the chart: beat-track's default drums (kick on each bar's beat 1, closed hi-hat on every
// beat, its velocities) and a bass holding each bar's first chart note two octaves down for the bar. Sorted by beat,
// note-offs before note-ons at the same beat.
export function bandEvents(chart: Chart): BandEvent[] {
  const mpb = msPerBeat(chart.bpm);
  const end = endBeat(chart);
  const drum = followSettings.drumChannel;
  const bass = followSettings.bassChannel;
  const events: BandEvent[] = beatHits(chart, 0, end * mpb, 0).map((h) => ({
    beat: h.atMs / mpb,
    data: [0x90 | drum, h.note, h.velocity],
    offAfterMs: beatSettings.noteLengthMs,
  }));
  for (let s = 0; s < end; s += chart.beatsPerBar) {
    const inBar = chart.notes.filter((n) => n.beat >= s - 1e-9 && n.beat < s + chart.beatsPerBar - 1e-9);
    if (!inBar.length) continue;
    const first = Math.min(...inBar.map((n) => n.beat));
    // A chord on the bar's first onset: its lowest note (decision score-follow-spike-band).
    const pitch = Math.min(...inBar.filter((n) => Math.abs(n.beat - first) < 1e-9).map((n) => n.pitch)) - 12 * followSettings.bassOctaves;
    events.push({ beat: s, data: [0x90 | bass, pitch, followSettings.bassVelocity] });
    events.push({ beat: s + chart.beatsPerBar, data: [0x80 | bass, pitch, 0] });
  }
  return events.sort((a, b) => a.beat - b.beat || (a.data[0] & 0xf0) - (b.data[0] & 0xf0));
}

// All Notes Off and the sustain pedal up on the band's two channels.
export const silence = (): number[][] =>
  [followSettings.bassChannel, followSettings.drumChannel].flatMap((ch) => [
    [0xb0 | ch, 123, 0],
    [0xb0 | ch, 64, 0],
  ]);

// The band's clock. It starts waiting at the first onset; each played onset (its first hit, at the press's wall time)
// sets the tempo to the mean of the last few onset-to-onset tempos and corrects the phase over the next beat. With no
// press it runs on at that tempo until waitBeats past the next unplayed onset, then waits there, and resumes from that
// onset when it's played.
// The spike's variants (FINDINGS.md): the spec's follower is the default. phaseGain corrects that share of each
// onset's phase error (1: all of it); trend extrapolates the samples' straight-line fit to the next onset instead of
// their mean, for a player who keeps speeding up or slowing down.
export interface Tune {
  phaseGain: number;
  trend: boolean;
}
export const specTune: Tune = { phaseGain: 1, trend: false };

export function follower(chart: Chart, onsetBeats: readonly number[], startRate = 1, tune: Tune = specTune) {
  const base = chart.bpm / 60000; // beats per wall ms at the chart's tempo
  let tempo = base * clampRate(startRate);
  let anchorBeat = onsetBeats[0] ?? 0;
  let anchorWall: number | null = null; // null: waiting at anchorBeat
  let err = 0; // phase error still being corrected, in beats
  let span = 1; // wall ms the correction takes (one beat at the tempo)
  let next = 0; // index of the next unplayed onset
  let last: { beat: number; wall: number } | null = null;
  const samples: number[] = []; // as fractions of the chart's tempo

  const cap = () => (next < onsetBeats.length ? onsetBeats[next] + followSettings.waitBeats : Infinity);
  const raw = (wall: number) => {
    if (anchorWall === null) return anchorBeat;
    const dt = Math.max(0, wall - anchorWall);
    return anchorBeat + tempo * dt + err * Math.min(1, dt / span);
  };

  return {
    beatAt: (wall: number) => Math.min(raw(wall), cap()),
    // The wall time the clock reaches beat (Infinity: not before the next onset is played).
    wallAt(beat: number): number {
      if (beat > cap() + 1e-9) return Infinity;
      if (anchorWall === null) return Infinity; // waiting: nothing sounds until the onset is played
      const corrected = anchorBeat + tempo * span + err; // where the correction ends
      if (beat <= corrected) return anchorWall + (beat - anchorBeat) / (tempo + err / span);
      return anchorWall + span + (beat - corrected) / tempo;
    },
    // Onset k played at wall. Onsets before it count as passed.
    played(k: number, wall: number) {
      if (k < next) return;
      const b = onsetBeats[k];
      const waiting = anchorWall === null || raw(wall) >= cap() - 1e-9;
      if (last && !waiting && wall > last.wall) {
        samples.push(clampRate((b - last.beat) / (wall - last.wall) / base));
        if (samples.length > flowSettings.tempoOnsets) samples.shift();
        const mean = samples.reduce((a, s) => a + s, 0) / samples.length;
        const n = samples.length;
        // least-squares slope over the samples' indexes, evaluated one step past the newest
        const slope = n < 3 ? 0 : samples.reduce((a, s, j) => a + (j - (n - 1) / 2) * (s - mean), 0) / samples.reduce((a, _, j) => a + (j - (n - 1) / 2) ** 2, 0);
        tempo = base * clampRate(tune.trend ? mean + slope * ((n + 1) / 2) : mean);
      }
      if (waiting) {
        anchorBeat = b; // resume from the onset itself (a wait isn't a tempo sample)
        err = 0;
      } else {
        anchorBeat = raw(wall);
        err = (b - anchorBeat) * tune.phaseGain;
      }
      anchorWall = wall;
      span = 1 / tempo;
      last = { beat: b, wall };
      next = k + 1;
    },
    // Pause: wait at the next unplayed onset.
    halt() {
      anchorBeat = onsetBeats[next] ?? anchorBeat;
      anchorWall = null;
      err = 0;
      last = null;
    },
    get rate() {
      return tempo / base;
    },
    get next() {
      return next;
    },
  };
}

export type Follower = ReturnType<typeof follower>;

// Sends the band's events as their time comes within the lookahead, each once, at the wall time wallAt gives then
// (an event already past is sent now). Drum note-offs follow their hits. The band enters with the first onset: events
// before it (a pickup bar's beats) never sound, and skip() drops what a pause leaves unsent, so a resume isn't a burst.
export function scheduler(events: readonly BandEvent[], fromBeat = -Infinity) {
  let i = 0;
  const sounding = new Set<string>(); // channel:note of the held notes it started, so a skipped one's off isn't sent
  const skip = (beat: number) => {
    while (i < events.length && events[i].beat < beat - 1e-9) i++;
  };
  skip(fromBeat);
  return {
    skip,
    fill(nowWall: number, wallAt: (beat: number) => number, send: (data: number[], at: number, beat: number) => void) {
      for (; i < events.length; i++) {
        const at = wallAt(events[i].beat);
        if (!(at < nowWall + followSettings.lookaheadMs)) break;
        const t = Math.max(at, nowWall);
        const [status, note] = events[i].data;
        const key = `${status & 0x0f}:${note}`;
        if ((status & 0xf0) === 0x80) {
          if (sounding.delete(key)) send(events[i].data, t, events[i].beat);
          continue;
        }
        if (events[i].offAfterMs === undefined) sounding.add(key);
        send(events[i].data, t, events[i].beat);
        const off = events[i].offAfterMs;
        if (off !== undefined) send([0x80 | (events[i].data[0] & 0x0f), events[i].data[1], 0], t + off, events[i].beat);
      }
    },
    get done() {
      return i >= events.length;
    },
  };
}
