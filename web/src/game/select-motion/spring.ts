// The select's one spring (spec: select-motion): critically damped, stepped by dt in closed form, so any frame length
// is exact and it never overshoots. A new target keeps the position and velocity, so a move mid-flight bends the
// motion instead of restarting it. The constants are choices (decision select-motion-spring).

export const springSettings = {
  responseS: 0.3, // Apple's default response at damping 1: ω = 2π / response
  repeatGain: 6, // during a held key, ω ≥ repeatGain / interval: a lag of a third of a row behind the focus
  maxOmega: 400, // about 16 ms of response: past this a frame can't show the difference
  restPx: 0.5, // closer than this and slower than restPxS, it lands on the target
  restPxS: 20,
};

export interface Spring {
  x: number;
  v: number; // px/s
  target: number;
  omega: number; // rad/s
}

export const BASE_OMEGA = (2 * Math.PI) / springSettings.responseS;

export const spring = (x: number): Spring => ({ x, v: 0, target: x, omega: BASE_OMEGA });

// How stiff for a move intervalMs after the last one: the base for a lone press, stiffer as the repeats get faster.
export function omegaFor(intervalMs: number | null): number {
  if (intervalMs === null || intervalMs <= 0) return BASE_OMEGA;
  return Math.min(springSettings.maxOmega, Math.max(BASE_OMEGA, (springSettings.repeatGain * 1000) / intervalMs));
}

export const retarget = (s: Spring, target: number, omega = s.omega): Spring => ({ ...s, target, omega });

export const settled = (s: Spring) => s.x === s.target && s.v === 0;

// x(t) = target + (d + (v + ωd)t)e^(−ωt), the critically damped solution from offset d and velocity v.
export function step(s: Spring, dtS: number): Spring {
  const d = s.x - s.target;
  const w = s.omega;
  const e = Math.exp(-w * dtS);
  const c = s.v + w * d;
  const x = s.target + (d + c * dtS) * e;
  const v = (c - w * (d + c * dtS)) * e;
  if (Math.abs(x - s.target) < springSettings.restPx && Math.abs(v) < springSettings.restPxS) return { ...s, x: s.target, v: 0 };
  return { ...s, x, v };
}

// Reduced motion, and the stage handoff: straight to the target.
export const cut = (s: Spring): Spring => ({ ...s, x: s.target, v: 0 });
