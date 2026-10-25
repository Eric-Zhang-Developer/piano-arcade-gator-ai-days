// Crowd Mode's clap detector (spec: crowd): spectral flux of the 2–8 kHz band, where a clap's noise sits and the
// piano's partials mostly don't, peaks over a causal adaptive threshold, kept only when the band is noise-like
// (spectral flatness). Near a MIDI note-on the threshold is raised, never blanked. One class with no imports, so the
// worklet runs this same text (worklet.ts) and vitest runs it offline. Every number: crowdSettings, chosen by the sweep
// in specs/decisions/crowd-onsets.md.
export const crowdSettings = {
  N: 512, // the FFT, ~10.7 ms at 48 kHz
  hop: 128, // one render quantum: a frame per block
  lowHz: 2000,
  highHz: 8000,
  compress: 1000, // log(1 + γ|X|) before the flux
  meanMs: 150, // the threshold's causal mean window
  lambda: 1.6, // the threshold: λ × that mean + δ
  delta: 8,
  flatMin: 0.25, // the band's flatness at the peak must reach this: noise, not partials
  floor: 1e-10, // a band whose mean bin power is under this has no spectrum to call noise: flatness 0 (silence reads 1)
  minGapMs: 60, // claps closer than this are one: a room's claps smear over a few tens of ms
  noteMs: 30, // within this of a note-on...
  noteRaise: 1.5, // ...the threshold is this much higher
  offsetMs: -2.5, // a frame's flux peak to the clap's first sample: the fixtures' signed median, so 0 on them
};

export type CrowdSettings = typeof crowdSettings;

export class ClapDetector {
  s: CrowdSettings;
  rate: number;
  buf: Float64Array; // the last N samples, a ring
  w: number; // the ring's next write, which is also its oldest sample
  fill: number; // samples since the last frame
  pos: number; // absolute index of the next sample in
  re: Float64Array;
  im: Float64Array;
  win: Float64Array;
  cos: Float64Array;
  sin: Float64Array;
  rev: Uint32Array;
  k0: number;
  k1: number;
  prev: Float64Array;
  hist: Float64Array; // recent flux, for the mean
  hi: number;
  sum: number;
  last: { flux: number; thr: number; flat: number; end: number }; // the frame before, a candidate peak
  before: number; // the flux two frames back
  lastOnset: number;
  notes: number[]; // note-on sample indices, ascending

  constructor(rate: number, s: CrowdSettings) {
    this.s = s;
    this.rate = rate;
    const N = s.N;
    this.buf = new Float64Array(N);
    this.w = 0;
    this.fill = 0;
    this.pos = 0;
    this.re = new Float64Array(N);
    this.im = new Float64Array(N);
    this.win = new Float64Array(N);
    for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    this.cos = new Float64Array(N / 2);
    this.sin = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / N);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / N);
    }
    const bits = Math.log2(N);
    this.rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.k0 = Math.ceil((s.lowHz * N) / rate);
    this.k1 = Math.min(N / 2, Math.floor((s.highHz * N) / rate));
    this.prev = new Float64Array(this.k1 - this.k0 + 1);
    this.hist = new Float64Array(Math.max(1, Math.round((s.meanMs / 1000) * (rate / s.hop))));
    this.hi = 0;
    this.sum = 0;
    this.last = { flux: 0, thr: Infinity, flat: 0, end: 0 };
    this.before = 0;
    this.lastOnset = -Infinity;
    this.notes = [];
  }

  // A note-on at absolute sample `at`: the threshold near it is raised.
  noteOn(at: number) {
    this.notes.push(at);
    if (this.notes.length > 64) this.notes.shift();
  }

  // Samples in; the onsets found, as absolute sample indices of each clap's start.
  push(x: Float32Array): number[] {
    const out: number[] = [];
    const N = this.s.N;
    for (let i = 0; i < x.length; i++) {
      this.buf[this.w] = x[i];
      this.w = (this.w + 1) % N;
      this.pos++;
      if (++this.fill >= this.s.hop) {
        this.fill = 0;
        const t = this.frame();
        if (t >= 0) out.push(t);
      }
    }
    return out;
  }

  fft() {
    const { re, im, cos, sin, rev } = this;
    const N = re.length;
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const step = N / size;
      for (let i = 0; i < N; i += size)
        for (let k = 0; k < half; k++) {
          const wr = cos[k * step];
          const wi = sin[k * step];
          const a = i + k;
          const b = a + half;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
    }
  }

  // One frame: returns an onset's sample index, or -1. A peak is called one frame late, once the next is lower.
  frame(): number {
    const s = this.s;
    const N = s.N;
    for (let i = 0, j = this.w; i < N; i++, j = (j + 1) % N) {
      this.re[i] = this.buf[j] * this.win[i];
      this.im[i] = 0;
    }
    this.fft();
    let flux = 0;
    let logSum = 0;
    let powSum = 0;
    const n = this.k1 - this.k0 + 1;
    for (let k = this.k0, j = 0; k <= this.k1; k++, j++) {
      const p = this.re[k] * this.re[k] + this.im[k] * this.im[k];
      const m = Math.log(1 + s.compress * Math.sqrt(p));
      const d = m - this.prev[j];
      if (d > 0) flux += d;
      this.prev[j] = m;
      logSum += Math.log(p + 1e-20);
      powSum += p;
    }
    const flat = powSum / n > s.floor ? Math.exp(logSum / n) / (powSum / n) : 0;
    // the mean of the frames before this one
    const mean = this.sum / this.hist.length;
    const end = this.pos;
    const near = this.notes.some((at) => Math.abs(end - s.N / 2 - at) <= (s.noteMs / 1000) * this.rate);
    const thr = (s.lambda * mean + s.delta) * (near ? s.noteRaise : 1);
    this.sum += flux - this.hist[this.hi];
    this.hist[this.hi] = flux;
    this.hi = (this.hi + 1) % this.hist.length;

    // Was the previous frame a peak? It must top the frame before it and this one, clear its threshold and be noise:
    // in it or in this frame, since the peak frame holds only the burst's first hop against a window of piano.
    const c = this.last;
    let onset = -1;
    if (c.flux > c.thr && c.flux >= this.before && c.flux > flux && Math.max(c.flat, flat) >= s.flatMin) {
      const at = Math.round(c.end - s.N / 2 - (s.offsetMs / 1000) * this.rate);
      if (at - this.lastOnset >= (s.minGapMs / 1000) * this.rate) {
        this.lastOnset = at;
        onset = at;
      }
    }
    this.before = c.flux;
    this.last = { flux, thr, flat, end };
    return onset;
  }
}

// Every onset in a whole signal, offline: the same pushes the worklet makes, a block at a time.
export function detect(x: Float32Array, rate: number, s: CrowdSettings = crowdSettings, noteOns: number[] = [], block = 128): number[] {
  const d = new ClapDetector(rate, s);
  const notes = [...noteOns].sort((a, b) => a - b);
  const out: number[] = [];
  let ni = 0;
  for (let i = 0; i < x.length; i += block) {
    // a note-on is known a little ahead of the audio that carries it: MIDI is faster than the mic
    while (ni < notes.length && notes[ni] <= i + block + (s.noteMs / 1000) * rate) d.noteOn(notes[ni++]);
    out.push(...d.push(x.subarray(i, Math.min(x.length, i + block))));
  }
  return out;
}
