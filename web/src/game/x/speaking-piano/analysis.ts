// The Speaking Piano's analysis (spike: speaking-piano, #1153): speech in, piano strikes out. One code path for the
// page and the offline scripts (Node runs this file through its type stripping), so: erasable TypeScript only, no
// imports. After Peter Ablinger's speaking piano: the voice's spectrum, frame by frame, struck on the 88 keys.

export interface AnalysisParams {
  fps: number; // frames a second: every key of a frame is struck at its start
  n: number; // keys struck a frame, at most
  floorDb: number; // a key sounds only within this many dB of the loudest band of the whole phrase
  velMin: number; // the velocity at the floor
  velCap: number; // the hard cap: the loudest band strikes at this
  fricativeRatio: number; // a frame whose 4–8 kHz energy is this share of its total gets a top-octave cluster
}

export const analysisDefaults: AnalysisParams = {
  fps: 12,
  n: 10,
  floorDb: 40,
  velMin: 24,
  velCap: 100,
  fricativeRatio: 0.35,
};

export interface Strike {
  key: number; // MIDI, 21–108
  vel: number; // 1–velCap
}

export interface Frame {
  tMs: number; // the frame's start, from the phrase's start
  strikes: Strike[];
  fricative: boolean;
}

export interface Analysis {
  params: AnalysisParams;
  frameMs: number;
  frames: Frame[];
  bandsDb: number[][]; // per frame, the 88 keys' weighted level in dB (key 21 first): the page's spectrogram
}

export const LOW_KEY = 21; // A0, the DGX-660's lowest
export const HIGH_KEY = 108; // C8
export const keyHz = (key: number): number => 440 * 2 ** ((key - 69) / 12);

// Speech's intelligibility sits in its formants: full weight over 300–2500 Hz, 12 dB an octave down outside it.
export function formantDb(hz: number): number {
  if (hz < 300) return -12 * Math.log2(300 / hz);
  if (hz > 2500) return -12 * Math.log2(hz / 2500);
  return 0;
}

// In place, radix-2. re and im have a power-of-two length.
export function fft(re: Float64Array, im: Float64Array): void {
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
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

// The FFT size for a sample rate: about 93 ms, so the low keys' semitones are at least near a bin apart.
const fftSize = (sampleRate: number): number => 2 ** Math.round(Math.log2(sampleRate * 0.093));

// Each key's band: the bins within a quarter tone of its fundamental, or the nearest bin where a semitone is narrower
// than a bin (the bass). Built once per sample rate.
function keyBands(sampleRate: number, size: number): { from: number; to: number; weightDb: number }[] {
  const binHz = sampleRate / size;
  const bands = [];
  for (let key = LOW_KEY; key <= HIGH_KEY; key++) {
    const hz = keyHz(key);
    const lo = Math.ceil((hz * 2 ** (-1 / 24)) / binHz);
    const hi = Math.floor((hz * 2 ** (1 / 24)) / binHz);
    const near = Math.round(hz / binHz);
    bands.push(hi >= lo ? { from: lo, to: hi, weightDb: formantDb(hz) } : { from: near, to: near, weightDb: formantDb(hz) });
  }
  return bands;
}

const db = (power: number) => 10 * Math.log10(power + 1e-12);

export function analyze(samples: Float32Array, sampleRate: number, params: AnalysisParams = analysisDefaults): Analysis {
  const size = fftSize(sampleRate);
  const hop = sampleRate / params.fps;
  const bands = keyBands(sampleRate, size);
  const binHz = sampleRate / size;
  const hiFrom = Math.round(4000 / binHz);
  const hiTo = Math.min(size / 2 - 1, Math.round(8000 / binHz));
  const window = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  const count = Math.max(1, Math.ceil(samples.length / hop));
  const bandsDb: number[][] = [];
  const fric: { ratio: number; db: number }[] = [];
  for (let f = 0; f < count; f++) {
    // Centered on the frame's middle, pre-emphasized (y[n] = x[n] − 0.97 x[n−1]) so the consonants aren't buried.
    const mid = Math.round(f * hop + hop / 2);
    for (let i = 0; i < size; i++) {
      const at = mid - size / 2 + i;
      const x = at >= 0 && at < samples.length ? samples[at] : 0;
      const prev = at - 1 >= 0 && at - 1 < samples.length ? samples[at - 1] : 0;
      re[i] = (x - 0.97 * prev) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    const power = (k: number) => re[k] * re[k] + im[k] * im[k];
    bandsDb.push(
      bands.map((b) => {
        let p = 0;
        for (let k = b.from; k <= b.to; k++) p += power(k);
        return db(p) + b.weightDb;
      }),
    );
    let total = 0;
    let high = 0;
    for (let k = 1; k <= hiTo; k++) {
      total += power(k);
      if (k >= hiFrom) high += power(k);
    }
    fric.push({ ratio: total > 0 ? high / total : 0, db: db(high) });
  }
  return { params, frameMs: 1000 / params.fps, frames: strikesFrom(bandsDb, fric, params), bandsDb };
}

// The frames' strikes: the top n keys above the floor, velocity linear in dB from the floor to the phrase's peak, and
// a soft top-octave cluster where the frame is mostly hiss. Every frame strikes its keys again, so a key that
// continues is re-struck and the piano's decay doesn't drop the sound.
export function strikesFrom(bandsDb: number[][], fric: { ratio: number; db: number }[], p: AnalysisParams): Frame[] {
  const peak = Math.max(...bandsDb.flat());
  const floor = peak - p.floorDb;
  const vel = (d: number) => Math.max(1, Math.min(p.velCap, Math.round(p.velMin + ((d - floor) / p.floorDb) * (p.velCap - p.velMin))));
  return bandsDb.map((row, f) => {
    const loud = row
      .map((d, i) => ({ key: LOW_KEY + i, d }))
      .filter((b) => b.d >= floor)
      .sort((a, b) => b.d - a.d);
    const isFric = fric[f].ratio >= p.fricativeRatio && fric[f].db >= floor;
    // The cluster takes up to 3 of the n: a soft hiss of the top octave's C, E and G♯ (C7 up), at half the frame's velocity.
    const cluster = isFric ? [96, 100, 104].slice(0, Math.min(3, p.n)).map((key) => ({ key, vel: Math.max(1, Math.round(vel(fric[f].db) / 2)) })) : [];
    const taken = new Set(cluster.map((s) => s.key));
    const tones = loud.filter((b) => !taken.has(b.key)).slice(0, p.n - cluster.length).map((b) => ({ key: b.key, vel: vel(b.d) }));
    return { tMs: (f * 1000) / p.fps, strikes: [...tones, ...cluster].sort((a, b) => a.key - b.key), fricative: isFric };
  });
}
