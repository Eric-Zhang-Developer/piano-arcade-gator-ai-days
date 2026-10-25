// The UI sound family's timbre (spec: ui-sound-family), pure: a synthesized celesta for the menus and a soft woodblock
// for the countdown, rendered to mono samples. index.ts plays the arrays as AudioBuffers; the tests measure the same
// arrays. The values are choices, logged in specs/decisions/ui-sound-family-timbre.md.
import type { UiSound } from ".";
import { beatSettings } from "../beat";

// Krumhansl–Kessler key profiles, tonic first (specs/decisions/ui-sound-family-key.md has the sources).
export const PROFILES = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
};

export interface Key {
  tonic: number; // pitch class, 0 = C
  mode: "major" | "minor";
}
export const C_MAJOR: Key = { tonic: 0, mode: "major" };

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

function pearson(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let n = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    n += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? n / Math.sqrt(da * db) : 0;
}

// The key whose profile best correlates with the pitch-class counts (Krumhansl–Schmuckler). No notes: C major.
export function keyOf(pitches: number[]): Key {
  if (!pitches.length) return C_MAJOR;
  const counts = Array<number>(12).fill(0);
  for (const p of pitches) counts[((p % 12) + 12) % 12]++;
  let best = C_MAJOR;
  let r = -Infinity;
  for (const mode of ["major", "minor"] as const)
    for (let tonic = 0; tonic < 12; tonic++) {
      const c = pearson(counts, PROFILES[mode].map((_, i) => PROFILES[mode][(i - tonic + 12) % 12]));
      if (c > r) [r, best] = [c, { tonic, mode }];
    }
  return best;
}

// A scale degree's frequency: degree 0 is the tonic between F#4 and F5, so every key sits in the same low-mid band.
export function degreeHz(key: Key, degree: number): number {
  const base = 60 + key.tonic + (key.tonic >= 6 ? 0 : 12); // F#4 (66) … F5 (77)
  const scale = SCALES[key.mode];
  const pitch = base + scale[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);
  return 440 * 2 ** ((pitch - 69) / 12);
}

export const timbreSettings = {
  // [frequency ratio, amplitude]: slightly stretched partials, as a struck bar's are, falling off fast.
  bell: { partials: [[1, 1], [2.01, 0.3], [3.03, 0.1], [4.07, 0.035]] as [number, number][], decayS: 0.045 },
  wood: { partials: [[1, 1], [2.47, 0.22]] as [number, number][], decayS: 0.012 },
  attackS: 0.005, // raised cosine: its 10–90% rise is 0.59 × this, about 3 ms
  hammerS: 0.0015, // a puff of noise inside the attack, so the strike has an edge without a click
  hammerLevel: 0.12,
  tailS: 0.012, // a raised-cosine fade over the last stretch: the last sample is exactly 0
};

export interface Strike {
  hz: number;
  atS: number;
  kind: "bell" | "wood";
  decayS?: number; // the fundamental's; each partial decays faster by its ratio^0.7
  gain?: number;
}

export const LENGTH_S: Record<UiSound, number> = { move: 0.12, confirm: 0.15, back: 0.15, sting: 0.55, tick: 0.06, tickAccent: 0.06 };

// What each sound strikes. step is move's place in the scale walk (index.ts counts it).
export function strikes(name: UiSound, key: Key, step = 0): Strike[] {
  const bell = (degree: number, atS: number, extra: Partial<Strike> = {}): Strike => ({ hz: degreeHz(key, degree), atS, kind: "bell", ...extra });
  switch (name) {
    case "move": // the next degree up the song's scale, an octave and back round
      return [bell(step % 8, 0)];
    case "confirm": // a struck fifth
      return [bell(0, 0), bell(4, 0, { gain: 0.8 })];
    case "back": // the fifth falling
      return [bell(4, 0), bell(0, 0.05)];
    case "sting": // up the triad, the last one ringing
      return [bell(0, 0, { gain: 0.8 }), bell(2, 0.09, { gain: 0.85 }), bell(4, 0.18, { decayS: 0.13 })];
    case "tick":
    case "tickAccent": // at beat-track's click pitches, so the countdown matches the count-in
      return [{ hz: name === "tick" ? beatSettings.clickHz : beatSettings.clickAccentHz, atS: 0, kind: "wood" }];
  }
}

// Mono samples, peak = level. Deterministic: the hammer noise comes from a fixed seed.
export function render(list: Strike[], lengthS: number, sampleRate: number, level: number): Float32Array<ArrayBuffer> {
  const { attackS, hammerS, hammerLevel, tailS } = timbreSettings;
  const n = Math.round(lengthS * sampleRate);
  const out = new Float32Array(n);
  let seed = 0x2f6b;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (const s of list) {
    const t0 = Math.round(s.atS * sampleRate);
    const { partials, decayS } = timbreSettings[s.kind];
    const tau = s.decayS ?? decayS;
    for (let i = t0; i < n; i++) {
      const t = (i - t0) / sampleRate;
      const attack = t < attackS ? 0.5 - 0.5 * Math.cos((Math.PI * t) / attackS) : 1;
      let v = 0;
      for (const [ratio, amp] of partials) v += amp * Math.exp(-t / (tau / ratio ** 0.7)) * Math.sin(2 * Math.PI * s.hz * ratio * t);
      if (t < hammerS) v += hammerLevel * rand() * Math.sin((Math.PI * t) / hammerS);
      out[i] += (s.gain ?? 1) * attack * v;
    }
  }
  const tail = Math.round(tailS * sampleRate);
  for (let i = 0; i < tail; i++) out[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / tail);
  let peak = 0;
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  if (peak) for (let i = 0; i < n; i++) out[i] *= level / peak;
  return out;
}

// Pile-up: at 20 moves a second, one new voice per minGapS at most. A sound inside it steals the oldest voice (a
// few-ms fade, not a cut), the cap holds, and velocity eases on fast repeats and is back to full after a pause.
export const pileSettings = { minGapS: 0.06, cap: 4, fastS: 0.15, ease: 0.88, floor: 0.55, recoverS: 0.4, fadeS: 0.005 };

export interface Voice {
  startS: number;
  endS: number;
}

export function admit<V extends Voice>(voices: V[], last: { atS: number; velocity: number }, atS: number) {
  const live = voices.filter((v) => v.endS > atS).sort((a, b) => a.startS - b.startS);
  const steal: V[] = [];
  if (live.length && atS - last.atS < pileSettings.minGapS) steal.push(live.shift()!);
  while (live.length >= pileSettings.cap) steal.push(live.shift()!);
  const gap = atS - last.atS;
  const velocity = gap >= pileSettings.recoverS ? 1 : gap < pileSettings.fastS ? Math.max(pileSettings.floor, last.velocity * pileSettings.ease) : last.velocity;
  return { live, steal, velocity };
}
