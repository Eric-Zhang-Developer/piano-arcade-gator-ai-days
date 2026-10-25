// Note material's pure half (spec: note-material): each layer's colors, alphas and timing, the contrast floors and the
// level of detail. No DOM, so the highway's draw and the tests share one rule. Choices are logged in
// specs/decisions/note-material-layers.md.

export const materialSettings = {
  emissionMs: 300, // the ignition: white heat ramps in over a note's last 300 ms (bloom starts earlier, at glowMs)
  emissionWhite: 0.42, // white over the body at the line, at full emission
  coreWhite: 0.16, // the emissive core: the body's center mixes this much white, the edges keep the pure hand color
  coreShare: 0.7, // of the pill's width, the core's soft band: a glow across the rod, not a stripe
  edgeShade: 0.18, // black at the rod's two long sides, so it reads round (a cylinder), not flat
  falloffPx: 36, // the trailing end darkens over this many px (or half the note, if shorter)
  falloffAlpha: 0.32, // black at the very trailing edge
  edgeAlpha: 0.3, // the specular top edge: white, one device pixel
  blackDepth: 0.16, // a black-key note's body mixes this much black: deeper, same rim and edge
  rimWhite: 0.35, // the rim mixes this much white into the hand color
  contrast: 3, // WCAG 1.4.11: the rim of a pill at its dimmest is this much against the field
  textureAlpha: 0.025, // the energy texture on long notes: 2.5% white, inside the spec's 2–3%
  textureBands: 4, // bands per beat; one band spacing scrolls past each beat
  longBeats: 1, // a note this long or longer carries the texture
  burnPx: 4, // the burn line at the hit line while held
  burnGlowPx: 26, // the heat rising from it into the held note, white-hot at the line
  hairlineShare: 0.6, // the chord hairline's luminance, as a share of the dimmest note's (bar-lines' calm rule)
  lodTexture: 48, // notes on screen past this: no texture
  lodBloom: 96, // past this: no bloom either
};

// The emission at msToHit: 0 until emissionMs out, rising straight to 1 at the line. None under reduced motion.
export function emission(msToHit: number, reduced: boolean): number {
  if (reduced) return 0;
  return 1 - Math.min(1, Math.max(0, msToHit / materialSettings.emissionMs));
}

// The texture's phase, 0–1: the chart clock's position inside its beat, so a band moves one spacing per beat and
// lines up with every beat.
export function texturePhase(nowMs: number, beatMs: number): number {
  const p = (nowMs / beatMs) % 1;
  return p < 0 ? p + 1 : p;
}

// One device pixel in CSS px, on a canvas drawn at this pixel ratio.
export const edgePx = (pixelRatio: number): number => 1 / Math.max(1, pixelRatio);

// The level of detail for this many notes on screen: dense passages drop the texture first, then the bloom.
export const lod = (onScreen: number) => ({
  texture: onScreen <= materialSettings.lodTexture,
  bloom: onScreen <= materialSettings.lodBloom,
});

// Notes that start together, as the indices of each group of two or more (a chord), by start time in ms.
export function chordGroups(starts: number[], epsMs = 1): number[][] {
  const order = starts.map((s, i) => [s, i]).sort((a, b) => a[0] - b[0]);
  const groups: number[][] = [];
  let cur: number[] = [];
  let at = -Infinity;
  for (const [s, i] of order) {
    if (s - at > epsMs) {
      if (cur.length > 1) groups.push(cur);
      cur = [];
      at = s;
    }
    cur.push(i);
  }
  if (cur.length > 1) groups.push(cur);
  return groups;
}

// Color math, sRGB 0–255.
type Rgb = [number, number, number];
export const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
export const mix = (c: Rgb, to: Rgb, t: number): Rgb => c.map((v, i) => v + (to[i] - v) * t) as Rgb;
export const css = (c: Rgb, a = 1): string => `rgba(${c.map((v) => Math.round(v)).join(",")},${a})`;
const toLinear = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const luminance = (c: Rgb): number => 0.2126 * toLinear(c[0]) + 0.7152 * toLinear(c[1]) + 0.0722 * toLinear(c[2]);
export const ratio = (a: Rgb, b: Rgb): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

// A note's body color: the hand color, deeper on a black key.
export const bodyColor = (hand: string, isBlack: boolean): Rgb =>
  isBlack ? mix(rgb(hand), BLACK, materialSettings.blackDepth) : rgb(hand);

export const rimColor = (hand: string): Rgb => mix(rgb(hand), WHITE, materialSettings.rimWhite);

// The rim's lowest alpha (over the note's black underlay) that keeps it at materialSettings.contrast against the field,
// so a far note's edge stays perceivable while its body keeps the approach dimming (note-pills' 35% → 100%).
const floors = new Map<string, number>();
export function rimFloor(hand: string, field: string): number {
  const key = `${hand}${field}`;
  let a = floors.get(key);
  if (a === undefined) {
    const c = rimColor(hand);
    const f = rgb(field);
    a = 1;
    for (let i = 0; i <= 100; i++)
      if (ratio(mix(BLACK, c, i / 100), f) >= materialSettings.contrast) {
        a = i / 100;
        break;
      }
    floors.set(key, a);
  }
  return a;
}

// The chord hairline's white alpha over the field: its luminance a share of the dimmest note's, never above it.
export function hairlineAlpha(dimmest: Rgb, field: string): number {
  const f = rgb(field);
  const target = luminance(f) + (luminance(dimmest) - luminance(f)) * materialSettings.hairlineShare;
  let a = 0;
  for (let i = 1; i <= 100; i++) if (luminance(mix(f, WHITE, i / 100)) <= target) a = i / 100;
  return a;
}

// Sprite size buckets: width to 4 px, height to the next power of two from 16 to 64 (only the leading end blooms).
export const bucket = (w: number, h: number): [number, number] => [
  Math.max(4, Math.ceil(w / 4) * 4),
  Math.min(64, Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, h))))),
];
