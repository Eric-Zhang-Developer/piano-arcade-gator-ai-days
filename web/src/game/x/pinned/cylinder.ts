// Pinned's mechanics (spec: pinned), pure: a take becomes pins on a cylinder that turns once over the whole take,
// played by a comb with one tooth per distinct pitch. Every pin is equal: a music box has no dynamics.
import type { TakeEvent } from "../../../contracts";

export interface Pin {
  pitch: number;
  timeMs: number; // from the first press
  angleDeg: number; // time ÷ length × 360
  tooth: number; // index into the comb, low to high
}

export interface Pinned {
  lengthMs: number; // first press to last release: one revolution
  pins: Pin[];
  teeth: number[]; // the comb's pitches, low to high, one per distinct pitch
}

export function pinTake(events: TakeEvent[]): Pinned {
  if (!events.length) return { lengthMs: 0, pins: [], teeth: [] };
  const t0 = Math.min(...events.map((e) => e.timeMs));
  const end = Math.max(...events.map((e) => e.offTimeMs ?? e.timeMs));
  const lengthMs = Math.max(1, end - t0);
  const teeth = [...new Set(events.map((e) => e.pitch))].sort((a, b) => a - b);
  const pins = events
    .map((e) => ({ pitch: e.pitch, timeMs: e.timeMs - t0, angleDeg: ((e.timeMs - t0) / lengthMs) * 360, tooth: teeth.indexOf(e.pitch) }))
    .sort((a, b) => a.timeMs - b.timeMs);
  return { lengthMs, pins, teeth };
}

export const hz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

// A cantilever's frequency goes as 1/L², so a tooth's length goes as 1/√f, scaled so the longest is `longest`.
export function toothLengths(pitches: number[], longest = 1): number[] {
  if (!pitches.length) return [];
  const raw = pitches.map((p) => 1 / Math.sqrt(hz(p)));
  const max = Math.max(...raw);
  return raw.map((l) => (l / max) * longest);
}

// Fit mode folds a take onto a real movement's teeth. It needs a cited tooth list (spec: never invent one), and none
// is cited yet (decision pinned-movement), so the page doesn't offer it.
export interface Movement {
  name: string;
  source: string; // the URL of the maker's or a published tooth list
  teeth: number[];
}

export interface Fit {
  pins: Pin[];
  moved: { pitch: number; to: number; semitones: number }[];
  dropped: number[]; // pitches with no tooth within maxShift, even an octave over
}

export function fit(p: Pinned, movement: Movement | null, maxShift = 1): Fit {
  if (!movement?.source || !movement.teeth.length) throw new Error("fit mode needs a movement with a cited tooth list");
  const moved: Fit["moved"] = [];
  const dropped: number[] = [];
  const teeth = [...movement.teeth].sort((a, b) => a - b);
  const pins: Pin[] = [];
  for (const pin of p.pins) {
    // The nearest tooth, trying the note itself first, then an octave either way.
    let best: number | null = null;
    for (const shifted of [pin.pitch, pin.pitch - 12, pin.pitch + 12])
      for (const t of teeth) if (Math.abs(t - shifted) <= maxShift && (best === null || Math.abs(t - pin.pitch) < Math.abs(best - pin.pitch))) best = t;
    if (best === null) {
      dropped.push(pin.pitch);
      continue;
    }
    if (best !== pin.pitch) moved.push({ pitch: pin.pitch, to: best, semitones: best - pin.pitch });
    pins.push({ ...pin, pitch: best, tooth: teeth.indexOf(best) });
  }
  return { pins, moved, dropped };
}
