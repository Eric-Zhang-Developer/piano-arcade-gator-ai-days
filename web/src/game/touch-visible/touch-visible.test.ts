import { describe, expect, it } from "vitest";
import { energyOf, matcher, normalizer, percentile, seedOf, touchOf, touchSettings as s } from "./energy";

describe("the normalizer (touch-visible)", () => {
  it("a chart with no velocities seeds 64 ± 20; 64 sits mid-range", () => {
    const seed = seedOf([]);
    expect(Math.min(...seed)).toBe(44);
    expect(Math.max(...seed)).toBe(84);
    expect(percentile(64, seed)).toBeCloseTo(0.5, 2);
  });

  it("a chart's own velocities seed it: its softest is low, its loudest is high", () => {
    const chart = [33, 40, 48, 55, 60, 70, 80, 95, 110, 127];
    const seed = seedOf(chart);
    expect(seed).toHaveLength(s.seedCount);
    expect(percentile(33, seed)).toBeLessThan(0.15);
    expect(percentile(127, seed)).toBeGreaterThan(0.85);
  });

  it("the take's own playing takes over: a soft player's loudest notes climb toward the top", () => {
    const n = normalizer(seedOf([]));
    const first = n.place(60);
    for (let i = 0; i < 64; i++) n.place(30 + (i % 4) * 10); // a soft take: 30–60
    expect(n.place(60)).toBeGreaterThan(first);
  });

  it("a laptop take at a fixed 80 settles mid-range", () => {
    const n = normalizer(seedOf([]));
    let p = 0;
    for (let i = 0; i < 100; i++) p = n.place(80);
    expect(p).toBeGreaterThan(0.4);
    expect(p).toBeLessThan(0.6);
  });
});

describe("the matcher (touch-visible)", () => {
  it("a 10-note chord at one onset gives each hit its own velocity", () => {
    const m = matcher();
    const chord = Array.from({ length: 10 }, (_, i) => [48 + i * 3, 20 + i * 10] as const);
    for (const [pitch, v] of chord) m.on(pitch, v, 1000);
    for (const [pitch, v] of [...chord].reverse()) expect(m.hit(pitch, 1005)).toBe(v);
  });

  it("a repeated pitch takes its latest unmatched note-on; an old one is out of the window", () => {
    const m = matcher();
    m.on(60, 40, 1000);
    m.on(60, 100, 1100);
    expect(m.hit(60, 1110)).toBe(100);
    expect(m.hit(60, 1120)).toBe(40);
    expect(m.hit(60, 1130)).toBeNull();
    m.on(62, 70, 1000);
    expect(m.hit(62, 1000 + s.matchMs + 1)).toBeNull();
  });
});

describe("the curve (touch-visible)", () => {
  const seed = seedOf([]);
  const steps = [16, 32, 48, 64, 80, 96, 112, 127];
  const energies = steps.map((v) => energyOf(percentile(v, seed)));

  it("energy rises strictly across 8 velocity steps", () => {
    for (let i = 1; i < energies.length; i++) expect(energies[i]).toBeGreaterThan(energies[i - 1]);
  });

  it("ff:pp is about 3–5× (a design choice: 1 / floor at the ends)", () => {
    const ratio = energies.at(-1)! / energies[0];
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThanOrEqual(5);
  });

  it("the top tenth rings, the bottom tenth is a wisp, the middle is neither", () => {
    expect(touchOf(0.95)).toMatchObject({ ring: true, wispOnly: false });
    expect(touchOf(0.05)).toMatchObject({ ring: false, wispOnly: true });
    expect(touchOf(0.5)).toMatchObject({ ring: false, wispOnly: false });
  });
});
