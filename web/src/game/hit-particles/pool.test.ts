import { describe, expect, it } from "vitest";
import { seededRandom } from "../sim/fake";
import { DEAD, DUST, FLOATS, WISP, governor, hitParticleSettings as S, particlePool, spawnCap } from "./pool";

const white = [1, 1, 1];

describe("pool", () => {
  it("is one fixed buffer: the same array, the same size, after any number of spawns", () => {
    const pool = particlePool(64, (n) => n);
    const data = pool.data;
    expect(data.length).toBe(64 * FLOATS);
    for (let i = 0; i < 64; i++) expect(data[i * FLOATS + 2]).toBe(DEAD); // every slot starts dead
    const r = seededRandom(1);
    for (let t = 0; t < 1000; t++) pool.spawn(DUST, 7, 100, 20, 500, white, 1, t, r);
    expect(pool.data).toBe(data);
    expect(pool.data.length).toBe(64 * FLOATS);
  });

  it("reuses slots: the head wraps and overwrites the oldest", () => {
    const pool = particlePool(8, (n) => n);
    const r = seededRandom(1);
    pool.spawn(DUST, 6, 0, 1, 0, white, 1, 10, r);
    expect(pool.head).toBe(6);
    pool.spawn(DUST, 4, 0, 1, 0, white, 1, 20, r);
    expect(pool.head).toBe(2);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => pool.data[i * FLOATS + 2])).toEqual([20, 20, 10, 10, 10, 10, 20, 20]);
  });

  it("reports the written slots in at most two runs, then nothing until the next spawn", () => {
    const pool = particlePool(8, (n) => n);
    const r = seededRandom(1);
    const runs: number[][] = [];
    pool.spawn(DUST, 6, 0, 1, 0, white, 1, 0, r);
    pool.dirty((s, c) => runs.push([s, c]));
    pool.spawn(DUST, 4, 0, 1, 0, white, 1, 0, r);
    pool.dirty((s, c) => runs.push([s, c]));
    pool.dirty((s, c) => runs.push([s, c]));
    pool.spawn(DUST, 20, 0, 1, 0, white, 1, 0, r); // more than the pool: every slot, once
    pool.dirty((s, c) => runs.push([s, c]));
    expect(runs).toEqual([[0, 6], [6, 2], [0, 2], [2, 6], [0, 2]]);
  });
});

describe("ribbons (#1373)", () => {
  it("a wisp is a run of segments sharing one origin and seed, each marking its place along the ribbon", () => {
    const pool = particlePool(64, (n) => n);
    pool.spawn(WISP, 2, 100, 20, 500, white, 1, 0, seededRandom(1), 4);
    const slot = (i: number) => pool.data.slice(i * FLOATS, i * FLOATS + 5);
    expect(pool.head).toBe(8);
    for (const start of [0, 4]) for (let k = 0; k < 4; k++) {
      expect(slot(start + k)[0]).toBe(slot(start)[0]); // x
      expect(slot(start + k)[3]).toBe(slot(start)[3]); // seed
      expect(slot(start + k)[4]).toBeCloseTo(WISP + k / 4); // kind + place
    }
    expect(slot(4)[3]).not.toBe(slot(0)[3]); // the next ribbon has its own seed
  });
});

describe("spawn cap", () => {
  it("a burst of hits never writes more than the cap in any 1 s window", () => {
    const cap = spawnCap();
    const writes: [number, number][] = [];
    // A ten-note chord of PERFECTs every 50 ms for 5 s, plus ten held keys streaming each 16 ms frame.
    for (let t = 0; t <= 5000; t += 1) {
      let want = 0;
      if (t % 50 === 0) want += 10 * S.dust.PERFECT;
      if (t % 16 === 0) want += 10 * Math.ceil((S.streamPerSec * 16) / 1000);
      if (want) writes.push([t, cap(want, t)]);
    }
    let worst = 0;
    for (const [t0] of writes) worst = Math.max(worst, writes.filter(([t]) => t >= t0 && t < t0 + 1000).reduce((s, [, k]) => s + k, 0));
    expect(worst).toBeLessThanOrEqual(S.capPerSec);
    expect(worst).toBeGreaterThan(S.capPerSec * 0.9); // and it does spend it
  });

  it("the pool writes only what the cap allows", () => {
    const pool = particlePool(S.slots);
    const written = pool.spawn(DUST, 100_000, 0, 1, 0, white, 1, 0, seededRandom(1));
    expect(written).toBe(S.capPerSec * S.burstShare);
    expect(pool.head).toBe(written);
  });
});

describe("governor", () => {
  const run = (frames: number[]) => {
    const g = governor();
    return frames.map(g);
  };

  it("halves spawning when frames run slow, at most every half second, and never reaches zero", () => {
    const shares = run(Array(600).fill(40)); // 24 s at 25 fps
    const cuts = shares.filter((v, i) => i > 0 && v < shares[i - 1]);
    expect(cuts.length).toBe(Math.log2(1 / S.governor.floor));
    for (let i = 1; i < shares.length; i++) expect(shares[i] === shares[i - 1] || shares[i] === shares[i - 1] / 2).toBe(true);
    expect(Math.min(...shares)).toBe(S.governor.floor);
    expect(shares.every((v) => v > 0)).toBe(true);
  });

  it("recovers slowly once frames are good again", () => {
    const slow = Array(300).fill(40);
    const good = Array(60 * 12).fill(1000 / 60); // 12 s at 60 fps
    const shares = run([...slow, ...good]);
    const at = (s: number) => shares[slow.length + Math.round(s * 60) - 1];
    expect(at(1)).toBeLessThan(0.25); // a second of good frames gives back a tenth, not the lot
    expect(at(5)).toBeLessThan(at(8));
    expect(at(12)).toBe(1);
  });

  it("stays at full on good frames, and a pause or one hitch doesn't cut it", () => {
    const shares = run([...Array(120).fill(16.7), 5000, ...Array(120).fill(16.7), 60, ...Array(120).fill(16.7)]);
    expect(shares.every((v) => v === 1)).toBe(true);
  });
});
