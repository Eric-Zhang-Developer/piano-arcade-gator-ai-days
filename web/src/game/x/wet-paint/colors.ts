// Wet Paint (spec: wet-paint): Scriabin's key colors by pitch class, from the Parisian score's table (1913). The
// source, the disagreements and why each hex is ours: specs/decisions/wet-paint-colors.md, whose table the test reads.
import type { Rgb } from "./vendor/fluid";

// C, C♯, D, ... B
export const SCRIABIN = ["#e0201b", "#8a2be2", "#ffd21f", "#6f88a8", "#2f8fb0", "#8e1a1a", "#3a2fa8", "#ff7a12", "#c8577e", "#3fa535", "#7d8590", "#4a7fd6"];

export const hexOf = (pitch: number): string => SCRIABIN[((pitch % 12) + 12) % 12];

// The solver's linear color, 0-1 per channel.
export function rgbOf(pitch: number): Rgb {
  const n = Number.parseInt(hexOf(pitch).slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
