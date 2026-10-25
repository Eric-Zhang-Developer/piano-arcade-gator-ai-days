// Note geometry and brightness the way visual-direction.md draws notes: pills sized to their key, about 2 px rounded,
// dim far from the line and full brightness at it. Pure, so the highway (core-loop) and its tests share one rule.

export const pillSettings = {
  whiteFill: 0.84, // of a white key's width: the highway's 8% inset each side
  blackToWhite: 0.56, // a black-key note's width over a white-key note's (Synthesia, reference-notes/synthesia-brahms.md)
  blackKeyToWhite: 0.6, // core's black key width over a white key's (highway.ts BLACK_KEY_WIDTH)
  radiusPx: 2, // visual-direction (Duo): only physical objects keep slight rounding, a note about 2 px
  farBrightness: 0.35, // at the top of the lookahead
};

// The pill inside its key: centered, and on a black key narrower so the ratio to a white-key pill is blackToWhite.
export function pillRect(key: { x: number; width: number }, isBlack: boolean): { x: number; width: number; radius: number } {
  const s = pillSettings;
  const width = key.width * (isBlack ? (s.whiteFill * s.blackToWhite) / s.blackKeyToWhite : s.whiteFill);
  return { x: key.x + (key.width - width) / 2, width, radius: Math.min(s.radiusPx, width / 2) };
}

// 0.35 at the top of the lookahead, rising straight to 1 at the line; notes at or past the line stay at 1.
export function brightness(msToHit: number, lookaheadMs: number): number {
  const t = Math.min(1, Math.max(0, msToHit / lookaheadMs));
  return 1 - (1 - pillSettings.farBrightness) * t;
}
