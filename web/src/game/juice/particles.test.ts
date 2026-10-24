import { expect, it } from "vitest";
import { seededRandom } from "../sim/fake";
import { particleSettings, spawn, step, type Particle } from "./particles";

// A dense scripted passage: a chord of 4 hits every 50 ms for 3 s, plus held-note sparks every frame.
function run(seed: number) {
  const r = seededRandom(seed);
  let ps: Particle[] = [];
  const counts: number[] = [];
  for (let t = 0; t < 3000; t += 16) {
    if (t % 48 === 0) for (let k = 0; k < 4; k++) ps = spawn(ps, "wisp", 18, k * 40, 30, 500, 1, r);
    ps = spawn(ps, "spark", 2, 0, 30, 500, 0.7, r);
    ps = step(ps, 16);
    counts.push(ps.length);
    for (const p of ps) expect(p.age).toBeLessThan(p.life);
  }
  return { ps, counts };
}

it("stays under the cap in a dense passage, and every particle dies within its lifetime", () => {
  const { ps, counts } = run(1);
  expect(Math.max(...counts)).toBeLessThanOrEqual(particleSettings.cap);
  expect(Math.max(...counts)).toBe(particleSettings.cap); // the passage really is dense enough to hit it
  let rest = ps;
  for (let t = 0; t < particleSettings.wispLifeMs[1]; t += 16) rest = step(rest, 16);
  expect(rest).toEqual([]);
});

it("is deterministic for a seed, and step() never mutates its input", () => {
  expect(run(7)).toEqual(run(7));
  const ps = spawn([], "wisp", 5, 0, 10, 100, 1, seededRandom(3));
  const copy = structuredClone(ps);
  step(ps, 100);
  expect(ps).toEqual(copy);
});

it("wisps rise and fade within about 1.5 s", () => {
  let ps = spawn([], "wisp", 50, 0, 10, 500, 1, seededRandom(2));
  for (const p of ps) expect(p.life).toBeLessThanOrEqual(1500);
  ps = step(ps, 500);
  for (const p of ps) expect(p.y).toBeLessThan(500);
});
