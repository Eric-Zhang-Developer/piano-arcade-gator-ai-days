// STOI, short-time objective intelligibility (Taal, Hendriks, Heusdens and Jensen, "An Algorithm for Intelligibility
// Prediction of Time–Frequency Weighted Noisy Speech", IEEE TASLP 19(7), 2011), from the paper, for the speaking-piano
// spike: numpy isn't on this machine and pystoi would be a download. `node stoi.mjs` runs its self-test.
//
// The paper's constants: 10 kHz, 256-sample Hann frames at 50% overlap with a 512-point FFT, 15 one-third-octave
// bands from 150 Hz, 30-frame (384 ms) segments, clipping at β = −15 dB, and silent frames (40 dB under the loudest
// clean frame) dropped from both signals first.
import { fft } from "../../web/src/game/x/speaking-piano/analysis.ts";

const FS = 10000;
const FRAME = 256;
const NFFT = 512;
const BANDS = 15;
const MIN_CF = 150;
const SEG = 30;
const BETA = -15;
const DYN_RANGE = 40;

// A windowed-sinc low-pass at 0.45 × the lower rate, then linear interpolation: good enough to put both signals on
// the same 10 kHz grid, and the same path for both.
export function resample(x, from, to = FS) {
  if (from === to) return Float64Array.from(x);
  const cut = (0.45 * Math.min(from, to)) / from;
  const half = 64;
  const taps = Float64Array.from({ length: 2 * half + 1 }, (_, i) => {
    const t = i - half;
    const sinc = t === 0 ? 2 * cut : Math.sin(2 * Math.PI * cut * t) / (Math.PI * t);
    return sinc * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (2 * half)));
  });
  const lp = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    for (let k = -half; k <= half; k++) {
      const j = i + k;
      if (j >= 0 && j < x.length) s += x[j] * taps[k + half];
    }
    lp[i] = s;
  }
  const n = Math.floor((x.length * to) / from);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = (i * from) / to;
    const a = Math.floor(p);
    const f = p - a;
    y[i] = (lp[a] ?? 0) * (1 - f) + (lp[a + 1] ?? 0) * f;
  }
  return y;
}

const hann = Float64Array.from({ length: FRAME }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 1)) / (FRAME + 1)));

function frames(x) {
  const out = [];
  for (let s = 0; s + FRAME <= x.length; s += FRAME / 2) out.push(Float64Array.from({ length: FRAME }, (_, i) => x[s + i] * hann[i]));
  return out;
}

const overlapAdd = (fs) => {
  const y = new Float64Array((fs.length + 1) * (FRAME / 2));
  fs.forEach((f, m) => f.forEach((v, i) => (y[m * (FRAME / 2) + i] += v)));
  return y;
};

// Drop the frames where the clean signal is more than 40 dB under its loudest, from both signals.
export function removeSilentFrames(x, y) {
  const fx = frames(x);
  const fy = frames(y);
  const energy = fx.map((f) => 20 * Math.log10(Math.sqrt(f.reduce((s, v) => s + v * v, 0)) + 1e-12));
  const max = Math.max(...energy);
  const keep = energy.map((e) => e > max - DYN_RANGE);
  return [overlapAdd(fx.filter((_, i) => keep[i])), overlapAdd(fy.filter((_, i) => keep[i] && fy[i]))];
}

// One-third-octave band magnitudes, [band][frame].
function bandMagnitudes(x) {
  const edges = [...Array(BANDS).keys()].map((j) => {
    const cf = MIN_CF * 2 ** (j / 3);
    return [Math.round((cf * 2 ** (-1 / 6) * NFFT) / FS), Math.round((cf * 2 ** (1 / 6) * NFFT) / FS)];
  });
  const fs = frames(x);
  const out = edges.map(() => new Float64Array(fs.length));
  fs.forEach((f, m) => {
    const re = new Float64Array(NFFT);
    const im = new Float64Array(NFFT);
    re.set(f);
    fft(re, im);
    edges.forEach(([lo, hi], j) => {
      let p = 0;
      for (let k = lo; k < hi; k++) p += re[k] * re[k] + im[k] * im[k];
      out[j][m] = Math.sqrt(p);
    });
  });
  return out;
}

/** STOI of a processed signal y against the clean x, both at sampleRate. About 0 (unintelligible) to 1. */
export function stoi(clean, processed, sampleRate) {
  let x = resample(clean, sampleRate);
  let y = resample(processed, sampleRate);
  const n = Math.min(x.length, y.length);
  [x, y] = removeSilentFrames(x.subarray(0, n), y.subarray(0, n));
  const X = bandMagnitudes(x);
  const Y = bandMagnitudes(y);
  const M = X[0].length;
  if (M < SEG) throw new Error(`stoi: ${M} frames after silence removal, fewer than one ${SEG}-frame segment`);
  const clip = 10 ** (-BETA / 20);
  let sum = 0;
  let count = 0;
  for (let m = SEG; m <= M; m++) {
    for (let j = 0; j < BANDS; j++) {
      const xs = X[j].subarray(m - SEG, m);
      const ys = Y[j].subarray(m - SEG, m);
      const nx = Math.sqrt(xs.reduce((s, v) => s + v * v, 0));
      const ny = Math.sqrt(ys.reduce((s, v) => s + v * v, 0));
      const alpha = nx / (ny + 1e-12);
      const yc = ys.map((v, i) => Math.min(alpha * v, xs[i] * (1 + clip)));
      const mx = xs.reduce((s, v) => s + v, 0) / SEG;
      const my = yc.reduce((s, v) => s + v, 0) / SEG;
      let num = 0;
      let dx = 0;
      let dy = 0;
      for (let i = 0; i < SEG; i++) {
        num += (xs[i] - mx) * (yc[i] - my);
        dx += (xs[i] - mx) ** 2;
        dy += (yc[i] - my) ** 2;
      }
      sum += num / (Math.sqrt(dx * dy) + 1e-12);
      count++;
    }
  }
  return sum / count;
}

// The self-test (spec, Validation a): identical ≈ 1; white noise at +10, 0 and −5 dB SNR scores lower each step; a
// copy delayed well past one 384 ms segment scores lower than the clean copy. Speech-like test signal: a vowel-ish
// harmonic tone, amplitude-modulated at syllable rate, with gaps.
export function selfTest() {
  const fs = 16000;
  const len = fs * 3;
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1;
  const clean = Float64Array.from({ length: len }, (_, i) => {
    const t = i / fs;
    const syll = Math.max(0, Math.sin(2 * Math.PI * 4 * t)) * (Math.floor(t * 2) % 3 === 2 ? 0.05 : 1);
    const f0 = 140 + 30 * Math.sin(2 * Math.PI * 0.7 * t);
    const formant = Math.sin(2 * Math.PI * 3 * t) > 0 ? [700, 1200] : [300, 2300];
    let s = 0;
    for (let h = 1; h * f0 < 4500; h++) {
      const hz = h * f0;
      const w = formant.reduce((a, c) => a + Math.exp(-(((hz - c) / 150) ** 2)), 0) + 0.05;
      s += w * Math.sin(2 * Math.PI * hz * t) / h ** 0.5;
    }
    return syll * s;
  });
  const power = clean.reduce((s, v) => s + v * v, 0) / len;
  const noisy = (snr) => {
    const k = Math.sqrt(power / 10 ** (snr / 10) / (1 / 3)); // uniform noise in [−1, 1] has power 1/3
    return clean.map((v) => v + k * rand());
  };
  const delayed = Float64Array.from({ length: len }, (_, i) => (i >= fs ? clean[i - fs] : 0));
  const r = {
    identical: stoi(clean, clean, fs),
    snr10: stoi(clean, noisy(10), fs),
    snr0: stoi(clean, noisy(0), fs),
    snrMinus5: stoi(clean, noisy(-5), fs),
    delayed1s: stoi(clean, delayed, fs),
  };
  const pass = r.identical > 0.99 && r.snr10 < r.identical && r.snr0 < r.snr10 && r.snrMinus5 < r.snr0 && r.delayed1s < r.identical - 0.1;
  return { ...r, pass };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = selfTest();
  process.stdout.write(JSON.stringify(r, (k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)) + "\n");
  process.exit(r.pass ? 0 : 1);
}
