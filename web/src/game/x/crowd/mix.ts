// Crowd Mode's test audio (spec: crowd): synthesized claps at known times over a piano bed, so detection is measured
// against the truth and nothing is downloaded (decision crowd-onsets: fixtures). vitest builds these mixes in memory;
// make-fixtures.mjs writes the same ones as WAVs for listening, kept out of git.
import type { Chart } from "../../../contracts";

export const clapSettings = {
  sampleRate: 48000,
  // The air between the palms rings at 0.5–1.6 kHz, by hand configuration (Jylhä & Erkut, DAFx-08, Table 1; Fu et al.,
  // Phys. Rev. Research 2025): each clap draws one, through a low-Q resonator...
  resonanceHz: [500, 1600],
  q: [2, 5],
  // ...plus the broadband edge flat palms add, the only part in the detector's 2–8 kHz band.
  edge: 0.35,
  attackS: 0.0005,
  decayS: 0.0025, // the envelope's time constant: a clap is gone in ~10 ms (Fu et al.)
  lengthS: 0.03,
  jitterMs: 18, // a room's claps scatter around the beat: seeded, ±2.5 × this at most
};

// The laptop voice (laptop-sound/synth.ts), ported to plain arithmetic: a triangle and a sine an octave up through a
// lowpass that opens with velocity, a 4 ms strike and a decay that's longer for low notes. The biquad is the RBJ
// lowpass at Q 1/√2 (Web Audio's default lowpass Q of 1 dB, near enough for a bed).
export const bedSettings = {
  leadS: 0.5, // silence before chart time 0: the mic is on before the song starts
  velocity: 80,
  peak: 0.35,
  attackS: 0.004,
  releaseS: 0.08,
  // A real piano's hammer adds a 1–4 ms broadband burst at each strike (Askenfelt & Jansson 1990); the laptop voice has
  // none. 0 is the laptop voice, the spec's bed; the stress bed sets it (decision crowd-onsets).
  hammer: 0,
  hammerDecayS: 0.0015,
};

// A seeded PRNG (mulberry32), so a mix is the same every run.
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hz = (p: number) => 440 * 2 ** ((p - 69) / 12);

export function pianoBed(chart: Chart, sampleRate = clapSettings.sampleRate, tailS = 1.5, s = bedSettings, seed = 99): Float32Array {
  const noise = rng(seed);
  const spb = 60 / chart.bpm;
  const end = s.leadS + Math.max(...chart.notes.map((n) => n.beat + n.duration)) * spb + tailS;
  const y = new Float32Array(Math.ceil(end * sampleRate));
  for (const n of chart.notes) {
    const v = (n.velocity ?? s.velocity) / 127;
    const f = hz(n.pitch);
    const t0 = s.leadS + n.beat * spb;
    const off = s.leadS + (n.beat + n.duration) * spb;
    const peak = s.peak * v ** 1.5;
    const tau = Math.max(0.6, 4 - (n.pitch - 21) / 30) / 3;
    // RBJ lowpass coefficients at the voice's cutoff.
    const fc = Math.min(16000, f * (2 + 8 * v));
    const w = (2 * Math.PI * fc) / sampleRate;
    const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
    const a0 = 1 + alpha;
    const b0 = (1 - Math.cos(w)) / 2 / a0;
    const b1 = (1 - Math.cos(w)) / a0;
    const a1 = (-2 * Math.cos(w)) / a0;
    const a2 = (1 - alpha) / a0;
    let [x1, x2, y1, y2] = [0, 0, 0, 0];
    const i0 = Math.floor(t0 * sampleRate);
    const i1 = Math.min(y.length, Math.ceil((off + s.releaseS * 6) * sampleRate));
    for (let i = i0; i < i1; i++) {
      const t = i / sampleRate - t0;
      const ph = (f * t) % 1;
      const tri = 1 - 4 * Math.abs(ph - 0.5); // the triangle, in phase with a sine
      const x = tri + 0.3 * Math.sin(2 * Math.PI * 2 * f * t);
      const out = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      [x2, x1, y2, y1] = [x1, x, y1, out];
      const at = i / sampleRate;
      let env = t < s.attackS ? (peak * t) / s.attackS : peak * Math.exp(-(t - s.attackS) / tau);
      if (at > off) env *= Math.exp(-(at - off) / s.releaseS);
      y[i] += env * out;
    }
    // the hammer's burst, high-passed (a first difference), scaled to the note's peak
    if (s.hammer > 0) {
      let px = 0;
      const n = Math.ceil(s.hammerDecayS * 6 * sampleRate);
      for (let i = 0; i < n && i0 + i < y.length; i++) {
        const x = noise() * 2 - 1;
        y[i0 + i] += s.hammer * peak * Math.exp(-i / sampleRate / s.hammerDecayS) * (x - px);
        px = x;
      }
    }
  }
  return y;
}

// One clap at sample 0: seeded noise through a resonator at the clap's own frequency, plus the broadband edge, under a
// sharp attack and a fast decay.
export function clap(next: () => number, sampleRate = clapSettings.sampleRate, s = clapSettings): Float32Array {
  const y = new Float32Array(Math.ceil(s.lengthS * sampleRate));
  const f0 = s.resonanceHz[0] + next() * (s.resonanceHz[1] - s.resonanceHz[0]);
  const q = s.q[0] + next() * (s.q[1] - s.q[0]);
  // RBJ band-pass, 0 dB at the peak
  const w = (2 * Math.PI * f0) / sampleRate;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const [b0, b2, a1, a2] = [alpha / a0, -alpha / a0, (-2 * Math.cos(w)) / a0, (1 - alpha) / a0];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < y.length; i++) {
    const t = i / sampleRate;
    const env = t < s.attackS ? t / s.attackS : Math.exp(-(t - s.attackS) / s.decayS);
    const x = next() * 2 - 1;
    const body = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, x, y1, body];
    y[i] = env * (body + s.edge * x);
  }
  return y;
}

const rms = (x: Float32Array, i0 = 0, i1 = x.length) => {
  let e = 0;
  let n = 0;
  for (let i = Math.max(0, i0); i < Math.min(x.length, i1); i++, n++) e += x[i] * x[i];
  return n ? Math.sqrt(e / n) : 0;
};

export interface Mix {
  samples: Float32Array;
  sampleRate: number;
  claps: number[]; // the truth: each clap's start, in seconds
  levelDb: number;
}

// Claps on `beats` (chart beats) with seeded jitter, over the bed, at `levelDb` clap-to-piano. The level is each
// clap's RMS over its first 20 ms against the bed's RMS over the notes' span (decision crowd-onsets: level measure).
export function crowdMix(chart: Chart, beats: number[], levelDb: number, seed = 1, sampleRate = clapSettings.sampleRate, s = clapSettings, bed0: Partial<typeof bedSettings> = {}): Mix {
  const b0 = { ...bedSettings, ...bed0 };
  const bed = pianoBed(chart, sampleRate, 1.5, b0);
  const next = rng(seed);
  const spb = 60 / chart.bpm;
  const span = Math.max(...chart.notes.map((n) => n.beat + n.duration)) * spb;
  const bedRms = rms(bed, Math.floor(b0.leadS * sampleRate), Math.floor((b0.leadS + span) * sampleRate));
  const out = new Float32Array(bed);
  const claps: number[] = [];
  const win = Math.round(0.02 * sampleRate);
  for (const b of beats) {
    // jitter: the mean of three uniforms, a soft bell, scaled so ±2.5 × jitterMs is the reach
    const j = (((next() + next() + next()) / 3) * 2 - 1) * 2.5 * s.jitterMs;
    const t = b0.leadS + b * spb + j / 1000;
    if (t < 0) continue;
    const c = clap(next, sampleRate, s);
    const g = (bedRms * 10 ** (levelDb / 20)) / Math.max(1e-9, rms(c, 0, win));
    const i0 = Math.round(t * sampleRate);
    for (let i = 0; i < c.length && i0 + i < out.length; i++) out[i0 + i] += g * c[i];
    claps.push(i0 / sampleRate);
  }
  return { samples: out, sampleRate, claps, levelDb };
}
