import { parseMidi, type PianoEvent, type RawMidi } from './capture';

/**
 * Takes for the tests, as raw messages in the DGX-660's wire format: keys on channel 1, a release as note-on at
 * velocity 0, and the sustain pedal as a ramp of CC 64 values sent on channel 1 and again on channel 2.
 *
 * `recordedPedal` is a real capture: one press and one release of the DGX-660's pedal, copied from
 * `spikes/piano-midi/python-piano.log` lines 23-44. Everything else is made here to that format, not recorded.
 */
export const recordedPedal: RawMidi[] = ([
  [112841.6, 0xb0, 0x03], [112842.1, 0xb1, 0x03], [112847.1, 0xb0, 0x14], [112847.5, 0xb1, 0x14],
  [112853.1, 0xb0, 0x25], [112853.5, 0xb1, 0x25], [112859.6, 0xb0, 0x37], [112859.7, 0xb1, 0x37],
  [112865.7, 0xb0, 0x3f], [112866.5, 0xb1, 0x3f], [112871.2, 0xb0, 0x7f], [112871.5, 0xb1, 0x7f],
  [114797.0, 0xb0, 0x4a], [114797.7, 0xb1, 0x4a], [114802.9, 0xb0, 0x3a], [114803.6, 0xb1, 0x3a],
  [114809.0, 0xb0, 0x22], [114809.5, 0xb1, 0x22], [114815.8, 0xb0, 0x0b], [114816.2, 0xb1, 0x0b],
  [114821.0, 0xb0, 0x00], [114821.5, 0xb1, 0x00],
] as const).map(([timeMs, status, value]) => ({ data: [status, 0x40, value], timeMs }));

/** Beat 0 of every made take. */
export const startMs = 1000;

/** A key struck at `atMs` and let go at `offMs`. */
export type Stroke = { pitch: number; atMs: number; velocity: number; offMs: number };

export function keys(strokes: readonly Stroke[]): RawMidi[] {
  return strokes.flatMap((s) => [
    { data: [0x90, s.pitch, s.velocity], timeMs: s.atMs },
    { data: [0x90, s.pitch, 0], timeMs: s.offMs },
  ]);
}

/** A pedal lift at `upMs` and press at `downMs`, shaped like the recorded ramps, with the channel 2 copy. */
export function pedalChange(upMs: number, downMs: number): RawMidi[] {
  const ramp = (atMs: number, values: readonly number[]) => values.flatMap((value, k) => [
    { data: [0xb0, 0x40, value], timeMs: atMs + 6 * k },
    { data: [0xb1, 0x40, value], timeMs: atMs + 6 * k + 0.5 },
  ]);
  return [...ramp(upMs, [0x4a, 0x3a, 0x22, 0x0b, 0x00]), ...ramp(downMs, [0x03, 0x14, 0x25, 0x37, 0x3f, 0x7f])];
}

/**
 * A one-octave C major scale at 72 bpm, one note a beat, each key held until 15 ms after the next one sounds.
 * `lateMs` and `velocity` give each note's miss against the click and its loudness; `pitches` can swap in wrong notes.
 */
export function scale({
  pitches = [60, 62, 64, 65, 67, 69, 71, 72],
  lateMs = [4, -6, 9, -3, 7, -8, 2, 5],
  velocity = [62, 66, 60, 65, 63, 67, 61, 64],
}: { pitches?: readonly number[]; lateMs?: readonly number[]; velocity?: readonly number[] } = {}): RawMidi[] {
  const beatMs = 60000 / 72;
  const at = pitches.map((_, k) => startMs + k * beatMs + lateMs[k]);
  return keys(pitches.map((pitch, k) => ({
    pitch,
    atMs: at[k],
    velocity: velocity[k],
    offMs: k + 1 < at.length ? at[k + 1] + 15 : at[k] + beatMs,
  })));
}

/** Runs messages through the same parse the piano's do, in time order. */
export function eventsOf(messages: readonly RawMidi[]): PianoEvent[] {
  return [...messages]
    .sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0))
    .flatMap((m) => parseMidi(m.data, m.timeMs ?? 0) ?? []);
}
