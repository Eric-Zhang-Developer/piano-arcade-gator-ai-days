// The resume countdown's clicks (spec: pause-skin): one per beat, beatMs apart, the first accented. Pure.
export interface Tick {
  atMs: number; // after the countdown shows
  accent: boolean;
}

export const tickSchedule = (beats: number, beatMs: number): Tick[] =>
  Array.from({ length: Math.max(0, beats) }, (_, i) => ({ atMs: i * beatMs, accent: i === 0 }));

// ↑/↓ in a menu of n items: the next index, stopping at the ends.
export const stepFocus = (index: number, step: number, n: number): number => Math.min(n - 1, Math.max(0, index + step));
