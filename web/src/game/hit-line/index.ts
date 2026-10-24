// The judgment line as a gently moving "electric" stroke (Synthesia, reference-notes/synthesia-brahms.md 2m13s).
// Three fixed sine waves, so the same time always gives the same path: no per-frame randomness to flicker.

export const hitLineSettings = {
  stepPx: 6, // one path point every this many px
  // Amplitudes sum to 2 px: with a 2 px core the stroke stays inside 6 px around the line.
  waves: [
    { amp: 1, lengthPx: 190, periodMs: 1700 },
    { amp: 0.6, lengthPx: 70, periodMs: -1100 },
    { amp: 0.4, lengthPx: 31, periodMs: 700 },
  ],
};

// Vertical offsets from the line along its width at chart time tMs; flat when still (reduced motion).
export function hitLinePath(width: number, tMs: number, still = false): { x: number; dy: number }[] {
  const { stepPx, waves } = hitLineSettings;
  const n = Math.max(1, Math.ceil(width / stepPx));
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = Math.min(width, i * stepPx);
    const dy = still ? 0 : waves.reduce((sum, w) => sum + w.amp * Math.sin(2 * Math.PI * (x / w.lengthPx + tMs / w.periodMs)), 0);
    return { x, dy };
  });
}
