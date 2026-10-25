import type { Range } from './params';

/** A seeded source of numbers in [0, 1): mulberry32, so the same seed always draws the same learners. */
export type Random = () => number;

export function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes numbers into one 32-bit seed (FNV-1a over their bytes), so each learner gets its own stream. */
export function mix(...parts: readonly number[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (let shift = 0; shift < 32; shift += 8) h = Math.imul(h ^ ((part >>> shift) & 0xff), 0x01000193) >>> 0;
  }
  return h;
}

export const between = (random: Random, [low, high]: Range) => low + (high - low) * random();
export const chance = (random: Random, p: number) => random() < p;

/** A standard normal draw (Box-Muller). */
export function normal(random: Random): number {
  const u = 1 - random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** An index drawn in proportion to its weight. */
export function weighted(random: Random, weights: readonly number[]): number {
  let r = random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** `count` distinct entries, in draw order. */
export function sample<T>(random: Random, from: readonly T[], count: number): T[] {
  const pool = [...from];
  const picked: T[] = [];
  while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return picked;
}

/** A UUID-shaped id from the stream, version 4 and variant bits set, so a seed can insert it as a uuid. */
export function uuid(random: Random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
