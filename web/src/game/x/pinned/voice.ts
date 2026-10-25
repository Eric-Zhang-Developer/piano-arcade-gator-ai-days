// Pinned's comb-tooth voice (spec: pinned), pure: a clamped-free cantilever's partials, a short pluck and per-partial
// decays, rendered to mono samples. The decays and levels are choices (decision pinned-voice).

// The roots of cos β · cosh β = −1, by bisection: Euler–Bernoulli clamped-free modes. Frequencies go as β².
export function cantileverBetas(n = 3): number[] {
  const f = (b: number) => Math.cos(b) * Math.cosh(b) + 1;
  const out: number[] = [];
  for (let lo = 0.5; out.length < n; lo += 0.5) {
    const hi = lo + 0.5;
    if (f(lo) * f(hi) > 0) continue;
    let [a, b] = [lo, hi];
    for (let i = 0; i < 80; i++) {
      const m = (a + b) / 2;
      if (f(a) * f(m) <= 0) b = m;
      else a = m;
    }
    out.push((a + b) / 2);
  }
  return out;
}

const BETAS = cantileverBetas(3);
export const RATIOS = BETAS.map((b) => (b / BETAS[0]) ** 2); // about 1 : 6.27 : 17.55

export const voiceSettings = {
  amps: [1, 0.18, 0.05], // per partial, for RATIOS
  decayS: [1.4, 0.22, 0.06], // per partial time constants: the upper modes die first, as a plucked tooth's do
  pluckS: 0.004, // a short noise click as the pin lets go
  pluckLevel: 0.25,
  attackS: 0.002, // raised cosine, so the onset never clicks
  lengthS: 2.2,
  peak: 0.18, // before the page's gain
};

// Above the Nyquist limit a partial is left out, not folded back.
export function renderTooth(f: number, sampleRate: number): Float32Array<ArrayBuffer> {
  const { amps, decayS, pluckS, pluckLevel, attackS, lengthS, peak } = voiceSettings;
  const n = Math.round(lengthS * sampleRate);
  const out = new Float32Array(n);
  let seed = 0x51ed;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let v = 0;
    RATIOS.forEach((r, k) => {
      if (f * r < sampleRate / 2) v += amps[k] * Math.exp(-t / decayS[k]) * Math.sin(2 * Math.PI * f * r * t);
    });
    if (t < pluckS) v += pluckLevel * rand() * (1 - t / pluckS);
    const attack = t < attackS ? 0.5 - 0.5 * Math.cos((Math.PI * t) / attackS) : 1;
    const tail = Math.min(1, (n - 1 - i) / (0.02 * sampleRate)); // the last 20 ms fade to exactly 0
    out[i] = v * attack * tail;
  }
  let max = 0;
  for (const x of out) max = Math.max(max, Math.abs(x));
  if (max) for (let i = 0; i < n; i++) out[i] *= peak / max;
  return out;
}
