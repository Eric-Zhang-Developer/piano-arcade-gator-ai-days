// Hit particles' pure part (spec: hit-particles): the fixed pool the GPU reads, the spawn cap and the governor.
// The CPU only writes spawns here; the shader in gl.ts computes each particle's position and fade from them.

export const hitParticleSettings = {
  slots: 16384, // spec: a fixed pool of ~16k
  capPerSec: 6000, // spawns written in any 1 s window, at most (decision hit-particles-spawn)
  burstShare: 0.2, // of the cap, spendable at once: a chord's hit; the rest refills evenly over the second
  dust: { PERFECT: 140, GREAT: 90, GOOD: 50 }, // specks per hit
  wisps: { PERFECT: 4, GREAT: 3, GOOD: 2 }, // crescents per hit
  bright: { PERFECT: 1, GREAT: 0.8, GOOD: 0.6 },
  streamPerSec: 420, // specks per second from each held hit key
  reducedMotion: 0.25, // of every spawn under prefers-reduced-motion
  governor: {
    slowMs: 20, // a smoothed frame time above this is slow (under 50 fps)
    smoothing: 0.05, // per frame, of the gap to the newest frame time: one 60 ms hitch moves it about 2 ms
    cutEveryMs: 500, // halve at most this often, so one hitch doesn't cut to the floor
    recoverPerSec: 0.1, // back up by a tenth of full rate per second of good frames: floor to full in about 9 s
    floor: 1 / 16, // never zero: the layer keeps spawning and drawing
    pauseMs: 250, // a gap this long is a pause (hidden tab, debugger), not a slow frame
  },
};

export type Judgment = keyof typeof hitParticleSettings.dust;
export const DUST = 0;
export const WISP = 1;

// One slot: x, y, born (ms on the layer's clock), seed, kind, bright, r, g, b.
export const FLOATS = 9;
export const DEAD = -1e9; // born long ago: the shader skips it

export interface Pool {
  data: Float32Array; // allocated once; the GPU buffer mirrors it
  head: number; // the next slot written; it wraps, overwriting the oldest
  spawn(kind: number, n: number, x: number, width: number, y: number, rgb: readonly number[], bright: number, nowMs: number, random: () => number): number;
  dirty(each: (start: number, count: number) => void): void; // the slots written since the last call, in up to two runs
}

export function particlePool(slots = hitParticleSettings.slots, cap = spawnCap()): Pool {
  const data = new Float32Array(slots * FLOATS);
  for (let i = 0; i < slots; i++) data[i * FLOATS + 2] = DEAD;
  let dirtyStart = 0;
  let dirtyCount = 0;
  const pool: Pool = {
    data,
    head: 0,
    spawn(kind, n, x, width, y, rgb, bright, nowMs, random) {
      const k = cap(n, nowMs);
      for (let i = 0; i < k; i++) {
        const o = pool.head * FLOATS;
        data[o] = x + random() * width;
        data[o + 1] = y;
        data[o + 2] = nowMs;
        data[o + 3] = random();
        data[o + 4] = kind;
        data[o + 5] = bright;
        data[o + 6] = rgb[0];
        data[o + 7] = rgb[1];
        data[o + 8] = rgb[2];
        if (dirtyCount === 0) dirtyStart = pool.head;
        dirtyCount = Math.min(slots, dirtyCount + 1);
        pool.head = (pool.head + 1) % slots;
      }
      return k;
    },
    dirty(each) {
      if (dirtyCount === 0) return;
      const end = dirtyStart + dirtyCount;
      if (end <= slots) each(dirtyStart, dirtyCount);
      else {
        each(dirtyStart, slots - dirtyStart);
        each(0, end - slots);
      }
      dirtyCount = 0;
    },
  };
  return pool;
}

// A token bucket: burstShare of the cap at once, the rest refilled evenly over a second, so any 1 s window holds at
// most capPerSec spawns. Returns how many of n may be written now.
export function spawnCap(capPerSec = hitParticleSettings.capPerSec, burstShare = hitParticleSettings.burstShare) {
  const size = capPerSec * burstShare;
  const rate = (capPerSec - size) / 1000; // per ms
  let tokens = size;
  let last: number | null = null;
  return (n: number, nowMs: number): number => {
    if (last !== null && nowMs > last) tokens = Math.min(size, tokens + (nowMs - last) * rate);
    last = last === null ? nowMs : Math.max(last, nowMs);
    const k = Math.max(0, Math.min(Math.floor(n), Math.floor(tokens)));
    tokens -= k;
    return k;
  };
}

// Feed it each frame's wall-clock length; it returns the share of spawning to keep, floor to 1. Slow frames halve it,
// good frames win it back slowly; it never reaches zero, and nothing here stops the layer drawing.
export function governor(g = hitParticleSettings.governor) {
  let smooth = 1000 / 60;
  let share = 1;
  let sinceCut = Infinity;
  return (frameMs: number): number => {
    if (!(frameMs >= 0) || frameMs >= g.pauseMs) return share;
    smooth += (frameMs - smooth) * g.smoothing;
    sinceCut += frameMs;
    if (smooth > g.slowMs) {
      if (sinceCut >= g.cutEveryMs) {
        share = Math.max(g.floor, share / 2);
        sinceCut = 0;
      }
    } else share = Math.min(1, share + (g.recoverPerSec * frameMs) / 1000);
    return share;
  };
}
