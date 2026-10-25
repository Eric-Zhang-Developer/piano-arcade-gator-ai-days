// Highlight reel's onset detector (spike: highlight-reel): where new sound starts in a mono signal. verify-highlight
// runs it on the WebM's decoded audio to check sync. Pure.
export const onsetSettings = {
  hopMs: 1, // energy frames
  historyMs: 20, // a new onset is louder than this much before it
  ratio: 4, // by this factor
  floor: 1e-6, // mean square below this is silence
  minGapMs: 30, // onsets closer than this count as one (a chord)
};

// Onset times in ms: the first sample, within the frame that jumped, whose |x| reaches half that frame's peak.
export function detectOnsets(x: Float32Array, sampleRate: number, s = onsetSettings): number[] {
  const hop = Math.max(1, Math.round((sampleRate * s.hopMs) / 1000));
  const n = Math.floor(x.length / hop);
  const e = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = i * hop; k < (i + 1) * hop; k++) sum += x[k] * x[k];
    e[i] = sum / hop;
  }
  const hist = Math.max(1, Math.round(s.historyMs / s.hopMs));
  const out: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < n; i++) {
    let before = 0;
    for (let k = Math.max(0, i - hist); k < i; k++) before += e[k];
    before /= Math.max(1, Math.min(hist, i));
    if (e[i] < s.floor || e[i] < s.ratio * before + s.floor) continue;
    // the jump may start in the previous frame: look from there
    const from = Math.max(0, (i - 1) * hop);
    const to = (i + 1) * hop;
    let peak = 0;
    for (let k = from; k < to; k++) peak = Math.max(peak, Math.abs(x[k]));
    let k = from;
    while (k < to && Math.abs(x[k]) < peak / 2) k++;
    const t = (k / sampleRate) * 1000;
    if (t - last >= s.minGapMs) out.push(t);
    last = t;
  }
  return out;
}

// Matches each expected onset (merged within minGapMs) to the nearest detected one within tolMs.
export function matchOnsets(expected: number[], detected: number[], tolMs = 50, s = onsetSettings) {
  const merged: number[] = [];
  for (const t of [...expected].sort((a, b) => a - b)) if (!merged.length || t - merged[merged.length - 1] >= s.minGapMs) merged.push(t);
  const errors: number[] = [];
  for (const t of merged) {
    let best = Infinity;
    for (const d of detected) if (Math.abs(d - t) < Math.abs(best)) best = d - t;
    if (Math.abs(best) <= tolMs) errors.push(best);
  }
  const abs = errors.map(Math.abs).sort((a, b) => a - b);
  const q = (p: number) => (abs.length ? abs[Math.min(abs.length - 1, Math.floor(p * (abs.length - 1) + 0.5))] : NaN);
  return { expected: merged.length, matched: errors.length, median: q(0.5), p90: q(0.9) };
}
