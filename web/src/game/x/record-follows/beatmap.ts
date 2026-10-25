// The beat map (spec: record-follows): recording seconds to chart beats. Onsets are found in the audio by spectral
// flux, then aligned to the chart's onsets by a DTW on inter-onset ratios, which don't care about tempo, so a
// recording that drifts maps beat by beat instead of through one offset. The matched pairs make a monotonic
// piecewise-linear map. composers-hands' dtw compares pitch sequences with an integer cost, so this one is separate.
// Parameters: specs/decisions/record-follows-dsp.md.
import { Stretcher } from "./vocoder";

export const onsetSettings = {
  N: 1024,
  hop: 256,
  compress: 100, // log(1 + γ|X|) before the flux, so quiet notes count
  meanS: 0.15, // the adaptive threshold's window, each side
  delta: 0.06, // ...plus this share of the loudest flux
  minGapS: 0.04, // a chord's notes are one onset
};

export const alignSettings = {
  gap: 0.6, // DTW cost of an onset only one side has (a missed or extra detection)
  firstWithinS: 0.25, // the first chart onset matches a detection this close to audio.json's offset
};

// Onset times in seconds: half-wave-rectified flux of the log magnitudes, peaks over a moving mean.
export function detectOnsets(x: Float32Array, sampleRate: number, s = onsetSettings): number[] {
  const v = new Stretcher(x, s.N, s.hop);
  const bins = s.N / 2 + 1;
  const frames = Math.max(0, Math.floor((x.length - s.N) / s.hop) + 1);
  const re = new Float64Array(s.N);
  const im = new Float64Array(s.N);
  let prev = new Float64Array(bins);
  const flux = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    v.frame(f * s.hop, re, im);
    const cur = new Float64Array(bins);
    let sum = 0;
    for (let k = 0; k < bins; k++) {
      cur[k] = Math.log1p(s.compress * Math.hypot(re[k], im[k]));
      sum += Math.max(0, cur[k] - prev[k]);
    }
    flux[f] = sum;
    prev = cur;
  }
  const top = Math.max(0, ...flux);
  const w = Math.round((s.meanS * sampleRate) / s.hop);
  const out: number[] = [];
  for (let f = 1; f < frames - 1; f++) {
    if (flux[f] < flux[f - 1] || flux[f] < flux[f + 1]) continue;
    let m = 0;
    let c = 0;
    for (let j = Math.max(0, f - w); j <= Math.min(frames - 1, f + w); j++, c++) m += flux[j];
    if (flux[f] < m / c + s.delta * top) continue;
    const t = (f * s.hop + s.N / 2) / sampleRate; // the frame's centre
    if (out.length && t - out[out.length - 1] < s.minGapS) continue;
    out.push(t);
  }
  return out;
}

export interface BeatMap {
  beatAt(sec: number): number;
  secAt(beat: number): number;
  bpsAt(sec: number): number; // chart beats per recording second at 1×
}

// Pairs [recording index, chart index] from a DTW on log inter-onset ratios (each onset's gap over the one before).
export function alignIndices(rec: readonly number[], chart: readonly number[], s = alignSettings): [number, number][] {
  const ratios = (t: readonly number[]) => t.map((_, i) => (i < 2 ? 0 : Math.log((t[i] - t[i - 1]) / Math.max(1e-6, t[i - 1] - t[i - 2]))));
  const a = ratios(rec);
  const b = ratios(chart);
  const n = a.length;
  const m = b.length;
  const W = m + 1;
  const D = new Float64Array((n + 1) * W).fill(Infinity);
  const step = new Uint8Array((n + 1) * W);
  D[0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      if (!i && !j) continue;
      let best = Infinity;
      let st = 0;
      if (i && j) {
        const d = D[(i - 1) * W + j - 1] + (i < 3 || j < 3 ? 0 : Math.abs(a[i - 1] - b[j - 1]));
        if (d < best) [best, st] = [d, 1];
      }
      if (i && D[(i - 1) * W + j] + s.gap < best) [best, st] = [D[(i - 1) * W + j] + s.gap, 2];
      if (j && D[i * W + j - 1] + s.gap < best) [best, st] = [D[i * W + j - 1] + s.gap, 3];
      D[i * W + j] = best;
      step[i * W + j] = st;
    }
  const pairs: [number, number][] = [];
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const st = step[i * W + j];
    if (st === 1) pairs.push([--i, --j]);
    else if (st === 2) i--;
    else j--;
  }
  return pairs.reverse();
}

// The map from detected onsets: the first chart onset is held to the detection nearest audio.json's offset (when it's
// close), the DTW pairs the rest, and only pairs that keep both sides increasing are kept.
export function beatMap(recOnsets: readonly number[], chartBeats: readonly number[], bpm: number, offsetS?: number, s = alignSettings): BeatMap {
  let rec = [...recOnsets];
  if (offsetS !== undefined) {
    const first = offsetS + (chartBeats[0] ?? 0) * (60 / bpm);
    const k = rec.findIndex((t) => t > first - s.firstWithinS);
    if (k > 0 && Math.abs(rec[k] - first) <= s.firstWithinS) rec = rec.slice(k);
  }
  const pts: [number, number][] = []; // [beat, sec]
  for (const [i, j] of alignIndices(rec, chartBeats, s)) {
    const p: [number, number] = [chartBeats[j], rec[i]];
    if (!pts.length || (p[0] > pts[pts.length - 1][0] && p[1] > pts[pts.length - 1][1])) pts.push(p);
  }
  return piecewise(pts, bpm);
}

// A monotonic piecewise-linear map through [beat, sec] points, at the chart's tempo past either end.
export function piecewise(pts: readonly [number, number][], bpm: number): BeatMap {
  const spb = 60 / bpm;
  if (!pts.length) pts = [[0, 0]];
  const last = pts.length - 1;
  const seg = (xs: (p: readonly [number, number]) => number, v: number) => {
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs(pts[mid]) <= v) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  return {
    secAt(beat) {
      if (beat <= pts[0][0] || !last) return pts[0][1] + (beat - pts[0][0]) * spb;
      if (beat >= pts[last][0]) return pts[last][1] + (beat - pts[last][0]) * spb;
      const i = seg((p) => p[0], beat);
      const [b0, s0] = pts[i];
      const [b1, s1] = pts[i + 1];
      return s0 + ((beat - b0) / (b1 - b0)) * (s1 - s0);
    },
    beatAt(sec) {
      if (sec <= pts[0][1] || !last) return pts[0][0] + (sec - pts[0][1]) / spb;
      if (sec >= pts[last][1]) return pts[last][0] + (sec - pts[last][1]) / spb;
      const i = seg((p) => p[1], sec);
      const [b0, s0] = pts[i];
      const [b1, s1] = pts[i + 1];
      return b0 + ((sec - s0) / (s1 - s0)) * (b1 - b0);
    },
    bpsAt(sec) {
      if (!last || sec <= pts[0][1] || sec >= pts[last][1]) return 1 / spb;
      const i = seg((p) => p[1], sec);
      // the tempo over a few segments, so one short gap doesn't swing it
      const a = pts[Math.max(0, i - 2)];
      const b = pts[Math.min(last, i + 3)];
      return (b[0] - a[0]) / (b[1] - a[1]);
    },
  };
}
