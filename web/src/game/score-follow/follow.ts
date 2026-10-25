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

// The estimating follower (the spike's second box, FINDINGS.md): a Kalman filter on the wall time of the last onset
// and the ms per beat (order 2), or those and the ms per beat's change per beat (order 3), so each press's jitter is
// averaged into the state instead of jumped to, and a tempo that keeps moving is tracked. Wall time is linear in the
// state between onsets, which keeps the model linear: predict the next onset's wall time, measure the press. The first
// press fixes the phase; the tempo starts at startRate with a wide variance, so the second press sets it.
export interface KalmanTune {
  order: 2 | 3;
  pressSdMs: number; // R = this²: how far a press lands from the player's intended beat
  drift: number; // q: the white noise driving the highest state (ms per beat per beat for order 2, per beat² for 3)
  startSd: number; // the start tempo's sd, as a fraction of its ms per beat
  startAccelSd: number; // order 3: the start sd of the ms per beat's change per beat, as a fraction of the ms per beat
}
// The sweep's pick (FINDINGS.md): order 3, R matched to the scripted jitter's sd (uniform ±30 ms), q from the sweep.
export const kalmanTune: KalmanTune = { order: 3, pressSdMs: 17, drift: 1, startSd: 0.5, startAccelSd: 0.02 };

type M = number[][];
const mul = (a: M, b: M): M => a.map((r) => b[0].map((_, j) => r.reduce((s, x, k) => s + x * b[k][j], 0)));
const tr = (a: M): M => a[0].map((_, j) => a.map((r) => r[j]));
const add = (a: M, b: M): M => a.map((r, i) => r.map((x, j) => x + b[i][j]));

// Transition and process noise over d beats (constant velocity or constant acceleration, white noise on the top state).
function model(order: 2 | 3, d: number, q: number): { F: M; Q: M } {
  if (order === 2)
    return { F: [[1, d], [0, 1]], Q: [[(q * d ** 3) / 3, (q * d * d) / 2], [(q * d * d) / 2, q * d]] };
  return {
    F: [[1, d, (d * d) / 2], [0, 1, d], [0, 0, 1]],
    Q: [
      [(q * d ** 5) / 20, (q * d ** 4) / 8, (q * d ** 3) / 6],
      [(q * d ** 4) / 8, (q * d ** 3) / 3, (q * d * d) / 2],
      [(q * d ** 3) / 6, (q * d * d) / 2, q * d],
    ],
  };
}

export function kalmanFollower(chart: Chart, onsetBeats: readonly number[], startRate = 1, tune: KalmanTune = kalmanTune) {
  const base = chart.bpm / 60000;
  const mpbAt = (rate: number) => 1 / (base * clampRate(rate));
  const [minP, maxP] = [mpbAt(flowSettings.maxRate), mpbAt(flowSettings.minRate)];
  const n = tune.order;
  const R = tune.pressSdMs ** 2;
  let refBeat = onsetBeats[0] ?? 0;
  let waiting = true; // at refBeat, until it's played
  let x: number[] = [0, mpbAt(startRate), 0].slice(0, n); // [wall ms of refBeat, ms per beat, (its change per beat)]
  const sd0 = [0, tune.startSd * x[1], tune.startAccelSd * x[1]];
  let C: M = x.map((_, i) => x.map((_, j) => (i === j ? sd0[i] ** 2 : 0)));
  let next = 0;

  const cap = () => (next < onsetBeats.length ? onsetBeats[next] + followSettings.waitBeats : Infinity);
  const P = () => Math.min(maxP, Math.max(minP, x[1]));
  // wall time of beat, from the state
  const wallOf = (beat: number) => {
    const d = beat - refBeat;
    return x[0] + d * P() + (n === 3 ? (x[2] * d * d) / 2 : 0);
  };
  const raw = (wall: number) => {
    if (waiting) return refBeat;
    let lo = refBeat;
    let hi = refBeat + 64;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (wallOf(mid) < wall) lo = mid;
      else hi = mid;
    }
    return lo;
  };

  return {
    beatAt: (wall: number) => Math.min(raw(wall), cap()),
    wallAt(beat: number): number {
      if (waiting || beat > cap() + 1e-9) return Infinity;
      return wallOf(beat);
    },
    played(k: number, wall: number) {
      if (k < next) return;
      const b = onsetBeats[k];
      if (waiting || raw(wall) >= cap() - 1e-9) {
        // the first press, or a resume after a wait: the phase is the press; the tempo stays (a wait isn't a sample)
        x[0] = wall;
        C = C.map((r, i) => r.map((c, j) => (i === 0 || j === 0 ? (i === j ? R : 0) : c)));
        waiting = false;
      } else {
        const { F, Q } = model(n, b - refBeat, tune.drift ** 2);
        const px = mul(F, x.map((v) => [v])).map((r) => r[0]);
        const pC = add(mul(mul(F, C), tr(F)), Q);
        const S = pC[0][0] + R;
        const K = pC.map((r) => r[0] / S);
        const r = wall - px[0];
        x = px.map((v, i) => v + K[i] * r);
        C = pC.map((row, i) => row.map((c, j) => c - K[i] * pC[0][j]));
      }
      refBeat = b;
      next = k + 1;
    },
    halt() {
      refBeat = onsetBeats[next] ?? refBeat;
      waiting = true;
    },
    get rate() {
      return 1 / (P() * base);
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
