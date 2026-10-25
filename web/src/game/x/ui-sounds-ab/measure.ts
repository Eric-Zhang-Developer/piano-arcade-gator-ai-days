// Offline measurements for ui-sound-family's Validation (a): old and new sounds, and the song preview they sit under,
// rendered as mono arrays and measured alike. Pure; the tests and the shots read it.
import type { Chart } from "../../../contracts";
import { opening, previewSettings } from "../../song-preview/opening";
import type { UiSound } from "../../ui-sounds";
import { UI_LEVEL, UI_PEAK, type Key } from "../../ui-sounds";
import { LENGTH_S, render, strikes } from "../../ui-sounds/timbre";
import { legacyTones } from "./legacy";

export const SR = 48000;

const wave = (type: OscillatorType, phase: number) => {
  const s = Math.sin(phase);
  if (type === "square") return s >= 0 ? 1 : -1;
  if (type === "triangle") return (2 / Math.PI) * Math.asin(s);
  return s;
};

// Juice-sound's tone() offline: the gain set at t, ramped exponentially to 0.001 over len, the oscillator stopped there.
function addTone(out: Float32Array, type: OscillatorType, hz: number, atS: number, lenS: number, level: number) {
  const t0 = Math.round(atS * SR);
  const n = Math.round(lenS * SR);
  for (let i = 0; i < n && t0 + i < out.length; i++) {
    const t = i / SR;
    out[t0 + i] += level * (0.001 / level) ** (t / lenS) * wave(type, 2 * Math.PI * hz * t);
  }
}

export function renderOld(name: UiSound): Float32Array {
  const tones = legacyTones(name);
  const out = new Float32Array(Math.round(Math.max(...tones.map((t) => t.atS + t.lenS)) * SR));
  for (const t of tones) addTone(out, t.type, t.hz, t.atS, t.lenS, UI_PEAK);
  return out;
}

export const renderNew = (name: UiSound, key: Key, step = 0) => render(strikes(name, key, step), LENGTH_S[name], SR, UI_LEVEL);

// song-preview's opening as laptop tones (playAsTones): triangles at velocity / 127 on a toneVolume bus.
export function renderPreview(chart: Chart): Float32Array {
  const notes = opening(chart);
  const end = Math.max(...notes.map((n) => n.startMs / 1000 + Math.max(0.05, n.durMs / 1000)));
  const out = new Float32Array(Math.round(end * SR));
  for (const n of notes)
    addTone(out, "triangle", 440 * 2 ** ((n.pitch - 69) / 12), n.startMs / 1000, Math.max(0.05, n.durMs / 1000), (previewSettings.toneVolume * n.velocity) / 127);
  return out;
}

// In place, radix 2.
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const [wr, wi] = [Math.cos(a * k), Math.sin(a * k)];
        const [xr, xi] = [re[i + k + len / 2], im[i + k + len / 2]];
        const [tr, ti] = [xr * wr - xi * wi, xr * wi + xi * wr];
        re[i + k + len / 2] = re[i + k] - tr;
        im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr;
        im[i + k] += ti;
      }
  }
}

// Magnitudes of one zero-padded frame, bins 0 … n/2.
export function spectrum(x: ArrayLike<number>, from = 0, size = 1 << Math.ceil(Math.log2(Math.max(2, x.length)))): Float64Array {
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < size && from + i < x.length; i++) re[i] = x[from + i];
  fft(re, im);
  const mag = new Float64Array(size / 2 + 1);
  for (let k = 0; k < mag.length; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

const dB = (x: number) => 20 * Math.log10(x);

export interface Measures {
  durationMs: number;
  peak: number;
  rms: number;
  centroidHz: number;
  attackMs: number; // 10–90% of the envelope's rise
  mean: number;
  last: number;
}

export function measure(x: Float32Array): Measures {
  let peak = 0;
  let sq = 0;
  let sum = 0;
  for (const v of x) {
    peak = Math.max(peak, Math.abs(v));
    sq += v * v;
    sum += v;
  }
  const mag = spectrum(x);
  let num = 0;
  let den = 0;
  for (let k = 0; k < mag.length; k++) {
    num += ((k * SR) / ((mag.length - 1) * 2)) * mag[k];
    den += mag[k];
  }
  // The envelope as a trailing 2 ms max of |x|: one period at the lowest pitch here, so it doesn't ripple.
  const w = Math.round(0.002 * SR);
  const env = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let m = 0;
    for (let j = Math.max(0, i - w); j <= i; j++) m = Math.max(m, Math.abs(x[j]));
    env[i] = m;
  }
  const top = Math.max(...env.subarray(0, Math.min(env.length, Math.round(0.05 * SR))));
  const at = (f: number) => env.findIndex((e) => e >= f * top);
  return {
    durationMs: (x.length / SR) * 1000,
    peak,
    rms: Math.sqrt(sq / x.length),
    centroidHz: num / den,
    attackMs: ((at(0.9) - at(0.1)) / SR) * 1000,
    mean: sum / x.length,
    last: x[x.length - 1],
  };
}

// How far under the reference, in dB (positive: quieter).
export const under = (x: number, ref: number) => dB(ref) - dB(x);
