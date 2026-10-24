// Wisps and sparks. Pure: spawning takes its random source as an argument, and step() only ages and moves.

export interface Particle {
  x: number;
  y: number;
  vx: number; // px per ms
  vy: number; // px per ms; negative rises
  age: number; // ms
  life: number; // ms
  size: number; // px
  bright: number; // 0–1 at birth
}

export const particleSettings = {
  cap: 300, // spec: at most 300 on screen; the oldest go first
  wispLifeMs: [900, 1500], // spec: wisps fade within about 1.5 s
  sparkLifeMs: [250, 550],
  wispRise: [0.05, 0.12], // px per ms
  sparkRise: [0.08, 0.2],
  sway: 0.02, // px per ms, either way
  drag: 0.0006, // per ms: wisps slow as they rise
};

const between = (r: () => number, [a, b]: number[]) => a + (b - a) * r();

// n particles across [x, x + width] at y. Wisps are soft and slow; sparks are small, quick and short.
export function spawn(
  ps: Particle[],
  kind: "wisp" | "spark",
  n: number,
  x: number,
  width: number,
  y: number,
  bright: number,
  r: () => number,
): Particle[] {
  const s = particleSettings;
  const wisp = kind === "wisp";
  const born = Array.from({ length: n }, () => ({
    x: x + r() * width,
    y,
    vx: (r() * 2 - 1) * s.sway,
    vy: -between(r, wisp ? s.wispRise : s.sparkRise),
    age: 0,
    life: between(r, wisp ? s.wispLifeMs : s.sparkLifeMs),
    size: wisp ? 1.5 + r() * 2 : 1 + r() * 0.8,
    bright,
  }));
  const all = [...ps, ...born];
  return all.length > s.cap ? all.slice(all.length - s.cap) : all;
}

export function step(ps: Particle[], dtMs: number): Particle[] {
  const k = Math.max(0, 1 - particleSettings.drag * dtMs);
  const out: Particle[] = [];
  for (const p of ps) {
    const age = p.age + dtMs;
    if (age >= p.life) continue;
    out.push({ ...p, age, x: p.x + p.vx * dtMs, y: p.y + p.vy * dtMs, vx: p.vx * k, vy: p.vy * k });
  }
  return out;
}

// Fades in fast, out slowly.
export const alphaOf = (p: Particle) => p.bright * Math.min(1, p.age / 60) * (1 - p.age / p.life);
