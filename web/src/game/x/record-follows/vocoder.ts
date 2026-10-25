// The stretch (spec: record-follows): a phase vocoder with identity phase locking, after Laroche & Dolson, "Improved
// phase vocoder time-scale modification of audio" (IEEE Trans. Speech and Audio Processing 7(3), 1999,
// doi:10.1109/89.759041), as read in Driedger & Müller's open review, "A Review of Time-Scale Modification of Music
// Signals" (Applied Sciences 6(2):57, 2016, https://www.mdpi.com/2076-3417/6/2/57, §5.6). Each output
// hop analyses the recording at `pos`, estimates each bin's instantaneous frequency from a second frame one hop
// earlier, advances the phase of the spectral peaks by that frequency, and locks every other bin to its peak's phase
// difference in the analysis (identity locking), which keeps a partial's bins coherent and cuts the "phasiness".
// `pos` moves `rate` hops of input per hop of output: rate 0.8 plays slower, the pitch unchanged. Frozen, `pos` stays
// and the phases keep advancing: the last frame's magnitudes, held (the spectral freeze).
//
// Self-contained on purpose: no imports and nothing at module scope, plain constructor assignments and index loops,
// so the AudioWorklet's source is this class's own text (worklet.ts) and vitest runs the very same code offline.
// Parameters: specs/decisions/record-follows-dsp.md.
export class Stretcher {
  declare input: Float32Array;
  declare N: number; // window, samples
  declare H: number; // output hop, samples
  declare pos: number; // input sample where the analysis frame starts
  declare rate: number;
  declare frozen: boolean;
  declare reset: boolean; // the next frame takes the analysis phases as they are: start, seek, a transient
  declare transientRatio: number; // a frame this many times louder than the last resets the phases
  declare win: Float64Array;
  declare re: Float64Array;
  declare im: Float64Array;
  declare re2: Float64Array;
  declare im2: Float64Array;
  declare mag: Float64Array;
  declare ph: Float64Array;
  declare freq: Float64Array; // rad per sample
  declare psi: Float64Array; // the synthesis phase
  declare peak: Int32Array; // each bin's peak
  declare ola: Float64Array;
  declare out: Float32Array; // the last hop's output
  declare outAt: number; // samples of `out` already handed on
  declare lastEnergy: number;
  declare norm: number;
  declare rev: Uint32Array;
  declare cos: Float64Array;
  declare sin: Float64Array;

  constructor(input: Float32Array, N = 2048, H = 512) {
    this.input = input;
    this.N = N;
    this.H = H;
    this.pos = 0;
    this.rate = 1;
    this.frozen = false;
    this.reset = true;
    this.transientRatio = 2;
    const bins = N / 2 + 1;
    this.win = new Float64Array(N);
    for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N); // periodic Hann
    this.norm = 1 / ((N / H) * 0.375); // Hann² overlap-added at hop H sums to (N / H) · 3/8
    this.re = new Float64Array(N);
    this.im = new Float64Array(N);
    this.re2 = new Float64Array(N);
    this.im2 = new Float64Array(N);
    this.mag = new Float64Array(bins);
    this.ph = new Float64Array(bins);
    this.freq = new Float64Array(bins);
    this.psi = new Float64Array(bins);
    this.peak = new Int32Array(bins);
    this.ola = new Float64Array(N);
    this.out = new Float32Array(H);
    this.outAt = H;
    this.lastEnergy = 0;
    const bits = Math.round(Math.log2(N));
    this.rev = new Uint32Array(N);
    for (let i = 0; i < N; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(N / 2);
    this.sin = new Float64Array(N / 2);
    for (let i = 0; i < N / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / N);
      this.sin[i] = Math.sin((2 * Math.PI * i) / N);
    }
  }

  // In-place radix-2 FFT; inverse unscaled (the caller divides by N).
  fft(re: Float64Array, im: Float64Array, inverse: boolean) {
    const N = this.N;
    for (let i = 0; i < N; i++) {
      const j = this.rev[i];
      if (j > i) {
        const tr = re[i];
        re[i] = re[j];
        re[j] = tr;
        const ti = im[i];
        im[i] = im[j];
        im[j] = ti;
      }
    }
    const sign = inverse ? 1 : -1;
    for (let size = 2; size <= N; size *= 2) {
      const half = size / 2;
      const step = N / size;
      for (let start = 0; start < N; start += size)
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step];
          const wi = sign * this.sin[k * step];
          const a = start + k;
          const b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
    }
  }

  // The windowed input frame starting at `at` (zeros outside the recording), transformed.
  frame(at: number, re: Float64Array, im: Float64Array) {
    const x = this.input;
    for (let i = 0; i < this.N; i++) {
      const k = at + i;
      re[i] = k >= 0 && k < x.length ? x[k] * this.win[i] : 0;
      im[i] = 0;
    }
    this.fft(re, im, false);
  }

  seek(sample: number) {
    this.pos = sample;
    this.reset = true;
  }

  // One output hop of H samples into `out`.
  hop() {
    const N = this.N;
    const H = this.H;
    const bins = N / 2 + 1;
    const at = Math.round(this.pos);
    this.frame(at, this.re, this.im);
    this.frame(at - H, this.re2, this.im2); // one hop earlier: the instantaneous frequency's lag
    let energy = 0;
    let top = 0;
    for (let k = 0; k < bins; k++) {
      const m = Math.hypot(this.re[k], this.im[k]);
      this.mag[k] = m;
      energy += m * m;
      if (m > top) top = m;
      const p = Math.atan2(this.im[k], this.re[k]);
      this.ph[k] = p;
      const w = (2 * Math.PI * k) / N;
      let d = p - Math.atan2(this.im2[k], this.re2[k]) - w * H;
      d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); // principal argument
      this.freq[k] = w + d / H;
    }
    if (!this.frozen && energy > this.transientRatio * this.lastEnergy + 1e-9) this.reset = true; // an attack
    this.lastEnergy = energy;
    // Peaks: a bin above its two neighbours each side; each bin belongs to the nearest peak (identity locking).
    let last = -1;
    const floor = top * 1e-4;
    for (let k = 0; k < bins; k++) {
      const m = this.mag[k];
      const isPeak =
        m > floor &&
        (k < 1 || m > this.mag[k - 1]) &&
        (k < 2 || m > this.mag[k - 2]) &&
        (k + 1 >= bins || m >= this.mag[k + 1]) &&
        (k + 2 >= bins || m >= this.mag[k + 2]);
      if (isPeak) {
        if (last >= 0) for (let j = Math.floor((last + k) / 2) + 1; j < k; j++) this.peak[j] = k;
        else for (let j = 0; j < k; j++) this.peak[j] = k;
        this.peak[k] = k;
        last = k;
      } else if (last >= 0) this.peak[k] = last;
      else this.peak[k] = -1;
    }
    if (this.reset) {
      for (let k = 0; k < bins; k++) this.psi[k] = this.ph[k];
      this.reset = false;
    } else {
      for (let k = 0; k < bins; k++) if (this.peak[k] === k) this.psi[k] += this.freq[k] * H;
      for (let k = 0; k < bins; k++) {
        const p = this.peak[k];
        if (p >= 0 && p !== k) this.psi[k] = this.psi[p] + this.ph[k] - this.ph[p];
      }
    }
    // Resynthesis: the magnitudes with the new phases, mirrored, inverse-transformed, windowed, overlap-added.
    for (let k = 0; k < bins; k++) {
      this.re[k] = this.mag[k] * Math.cos(this.psi[k]);
      this.im[k] = this.mag[k] * Math.sin(this.psi[k]);
    }
    for (let k = 1; k < N / 2; k++) {
      this.re[N - k] = this.re[k];
      this.im[N - k] = -this.im[k];
    }
    this.fft(this.re, this.im, true);
    const g = this.norm / N;
    for (let i = 0; i < N; i++) this.ola[i] += this.re[i] * this.win[i] * g;
    for (let i = 0; i < H; i++) this.out[i] = this.ola[i];
    this.ola.copyWithin(0, H);
    this.ola.fill(0, N - H);
    this.outAt = 0;
    if (!this.frozen) this.pos += this.rate * H;
  }

  // Fills `dest` (any length, the worklet's 128), running hops as needed.
  process(dest: Float32Array) {
    for (let i = 0; i < dest.length; i++) {
      if (this.outAt >= this.H) this.hop();
      dest[i] = this.out[this.outAt++];
    }
  }
}
