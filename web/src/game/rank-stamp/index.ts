// Rank stamp (spec: rank-stamp): the rank letter drops from 1.6× to 1× with one overshoot, and a gold ring flashes
// out at impact. The timing is shared: juice-visual draws the stamp, juice-sound lands the rank hit on its impact.

export const stampSettings = {
  afterTallyMs: 1200, // the stamp starts when the results tally ends (results-tally's totalMs; a test pins it)
  from: 1.6,
  durationMs: 300,
  flashMs: 420, // the gold ring, from impact
};

// easeOutBack: 0 → 1, past 1 once, back to exactly 1
const c1 = 1.70158;
const c3 = c1 + 1;
const back = (t: number) => 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;

// The rank's scale at progress t (0–1) of the stamp: from 1.6 down through 1, a little under, and back to exactly 1.
export function stampScale(t: number): number {
  const { from } = stampSettings;
  return 1 + (from - 1) * (1 - back(Math.min(1, Math.max(0, t))));
}

// Where the letter first reaches 1×, as a fraction of the stamp: back(t) = 1 at t = 1 - c1 / c3.
export const impactT = 1 - c1 / c3;

// When the stamp starts and when it hits, in ms after the results show (songEnd).
export const stampStartMs = () => stampSettings.afterTallyMs;
export const stampImpactMs = () => stampStartMs() + Math.round(impactT * stampSettings.durationMs);

// The stamp as CSS keyframes, sampled from stampScale, so the page and the tests share one curve.
export function stampKeyframes(name: string, steps = 12): string {
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const opacity = Math.min(1, t / impactT); // in from nothing, solid by impact
    return `${((t * 100).toFixed(2))}% { transform: scale(${stampScale(t).toFixed(4)}); opacity: ${opacity.toFixed(3)} }`;
  });
  return `@keyframes ${name} { ${frames.join(" ")} }`;
}
