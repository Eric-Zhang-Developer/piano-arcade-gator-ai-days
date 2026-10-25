// The synthetic recording (spec: record-follows): a library chart rendered in code through a plain additive piano (a
// few decaying partials per note) on a known tempo curve, so the true beat map is exact and nothing is downloaded or
// committed (audio-track's fixture decision B, specs/decisions/audio-track-fixture.md). The tests measure against
// `secAt`; the page plays it with `&record=synthetic`.
import type { Chart } from "../../../contracts";

export const synthSettings = {
  sampleRate: 22050, // the tests'; the page renders at the AudioContext's own rate
  leadS: 0.5, // silence before chart time 0
  swing: 0.04, // the recording's tempo wanders ±4% around the chart's...
  swingBeats: 32, // ...over this many beats, so drift lives in the map and not in one offset
  partials: [1, 0.45, 0.22, 0.1], // amplitude of harmonics 1–4
  attackS: 0.004,
  releaseS: 0.12,
  peak: 0.7, // the render is normalized to this
};

export interface Recording {
  samples: Float32Array;
  sampleRate: number;
  offsetMs: number; // file time of chart time 0, as audio.json's offsetMs
  secAt(beat: number): number; // the truth: file seconds of a chart beat
}

// File seconds of each chart beat, integrating 1 / tempo over a 1/32-beat grid.
export function tempoMap(chart: Chart, beats: number, s = synthSettings): (beat: number) => number {
  const spb = 60 / chart.bpm;
  const step = 1 / 32;
  const n = Math.ceil(beats / step) + 2;
  const t = new Float64Array(n + 1);
  t[0] = s.leadS;
  for (let i = 0; i < n; i++) {
    const mid = (i + 0.5) * step;
    t[i + 1] = t[i] + (step * spb) / (1 + s.swing * Math.sin((2 * Math.PI * mid) / s.swingBeats));
  }
  return (beat) => {
    const x = Math.max(0, beat) / step;
    const i = Math.min(n - 1, Math.floor(x));
    return t[i] + (t[i + 1] - t[i]) * (x - i) + (beat < 0 ? beat * spb : 0);
  };
}

export function renderSynthetic(chart: Chart, sampleRate = synthSettings.sampleRate, s = synthSettings): Recording {
  const end = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  const secAt = tempoMap(chart, end + 2, s);
  const total = Math.ceil((secAt(end) + 2) * sampleRate);
  const y = new Float32Array(total);
  for (const n of chart.notes) {
    const f = 440 * 2 ** ((n.pitch - 69) / 12);
    const t0 = secAt(n.beat);
    const t1 = secAt(n.beat + n.duration);
    const decay = 0.3 + 1.6 * Math.max(0, (84 - n.pitch) / 48); // low notes ring longer
    const amp = ((n.velocity ?? 80) / 127) * 0.2;
    const i0 = Math.floor(t0 * sampleRate);
    const i1 = Math.min(total, Math.ceil((t1 + s.releaseS) * sampleRate));
    for (let i = i0; i < i1; i++) {
      const t = i / sampleRate - t0;
      const after = i / sampleRate - t1;
      const env = Math.min(1, t / s.attackS) * Math.exp(-t / decay) * (after > 0 ? Math.max(0, 1 - after / s.releaseS) : 1);
      let v = 0;
      for (let k = 0; k < s.partials.length; k++) if (f * (k + 1) < sampleRate / 2) v += s.partials[k] * Math.sin(2 * Math.PI * f * (k + 1) * t);
      y[i] += amp * env * v;
    }
  }
  let top = 0;
  for (let i = 0; i < total; i++) top = Math.max(top, Math.abs(y[i]));
  if (top > 0) for (let i = 0; i < total; i++) y[i] *= s.peak / top;
  return { samples: y, sampleRate, offsetMs: secAt(0) * 1000, secAt };
}
