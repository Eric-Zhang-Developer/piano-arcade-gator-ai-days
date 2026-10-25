// Touch visible's pure part (spec: touch-visible): a note-on's velocity, placed within the take's own range, becomes
// the hit's visual energy. Every number is a design choice, logged in specs/decisions/touch-visible-curve.md.

export const touchSettings = {
  exponent: 0.5, // the compressive curve: energy rises fast from pp, then flattens toward ff
  floor: 0.25, // a pp hit's energy, so ff:pp is 1 / floor = 4×, inside the spec's 3–5× range
  softness: 8, // velocity units: each sample's step in the percentile is this wide, so it rises strictly everywhere
  seedMid: 64, // with no chart velocities, the seed is seedMid ± seedWidth
  seedWidth: 20,
  seedCount: 16, // the seed weighs as this many notes: the take's own playing outweighs it after a phrase
  ringFrom: 0.9, // the top tenth of the range rings
  wispBelow: 0.1, // the bottom tenth is one wisp, no sparks
  matchMs: 250, // a hit takes the latest unmatched note-on of its pitch from this long before it
};

// The seed the take starts from: the chart's own velocities, thinned to seedCount, or seedMid ± seedWidth evenly.
export function seedOf(chartVelocities: number[], s = touchSettings): number[] {
  const v = chartVelocities.filter((x) => x > 0).sort((a, b) => a - b);
  const n = s.seedCount;
  if (!v.length) return Array.from({ length: n }, (_, i) => s.seedMid - s.seedWidth + (2 * s.seedWidth * i) / (n - 1));
  return Array.from({ length: n }, (_, i) => v[Math.round((i * (v.length - 1)) / (n - 1))]);
}

// Where a velocity sits among the samples, 0–1: a smoothed percentile (each sample a logistic step softness wide),
// so equal velocities sit at 0.5 among themselves and it never plateaus at the ends.
export function percentile(v: number, samples: number[], s = touchSettings): number {
  if (!samples.length) return 0.5;
  let sum = 0;
  for (const x of samples) sum += 1 / (1 + Math.exp(-(v - x) / (s.softness / 4)));
  return sum / samples.length;
}

// Normalized placement to energy: floor at 0, 1 at the top.
export const energyOf = (p: number, s = touchSettings) => s.floor + (1 - s.floor) * Math.max(0, Math.min(1, p)) ** s.exponent;

export interface Touch {
  energy: number; // floor–1: spawn counts and brightness scale by it
  ring: boolean; // the top tenth: a thin shockwave ring
  wispOnly: boolean; // the bottom tenth: one wisp, no sparks
}
export const touchOf = (p: number, s = touchSettings): Touch => ({ energy: energyOf(p, s), ring: p >= s.ringFrom, wispOnly: p <= s.wispBelow });

// One take's running placement: the seed, then every velocity played, the seed's weight fixed at seedCount notes.
export function normalizer(seed: number[]) {
  const played: number[] = [];
  return {
    place(v: number): number {
      const p = percentile(v, [...seed, ...played]);
      played.push(v);
      return p;
    },
    reset: () => void (played.length = 0),
  };
}

// Note-ons by pitch, so each hit takes its own velocity: the latest unmatched one of its pitch within matchMs.
export function matcher(s = touchSettings) {
  const ons = new Map<number, { atMs: number; velocity: number }[]>();
  return {
    on(pitch: number, velocity: number, atMs: number) {
      const list = ons.get(pitch) ?? [];
      list.push({ atMs, velocity });
      while (list.length > 8) list.shift();
      ons.set(pitch, list);
    },
    // The velocity of the hit on pitch at nowMs (the note-on's clock), or null when no note-on is near.
    hit(pitch: number, nowMs: number): number | null {
      const list = ons.get(pitch);
      const i = list ? list.findLastIndex((o) => nowMs - o.atMs <= s.matchMs && o.atMs <= nowMs + 1) : -1;
      if (i < 0) return null;
      const [o] = list!.splice(i, 1);
      return o.velocity;
    },
    clear: () => ons.clear(),
  };
}
