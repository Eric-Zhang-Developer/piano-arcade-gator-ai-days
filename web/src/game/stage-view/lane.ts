// /stage's lane: NOSTALGIA's hill, measured from the reference video (specs/context/nostalgia-stage-findings.md).
// The measurements are fractions of the video's 1706×1440 frame, whose game screen is the top 16:9 (y 0 to 0.667) with
// the player's keyboard below, so a screen y is the frame y × 1.5 (decision stage-view-geometry). x is a fraction of
// the width in both. Pure, so a test pins the curve.

const SCREEN = 1440 / (1706 * (9 / 16)); // 1.5: frame y to screen y

export const stageLane = {
  approachMs: 1033, // first faint sighting to the bar, 3 notes, no spread
  crestMs: 497, // the crest's time before the hit: the front face's vertex
  barY: 0.555 * SCREEN, // the judgment bar's centre
  crestY: 0.045 * SCREEN,
  noteW: 0.1, // a note's width as a fraction of the field's width there (0.100 at the bar, 0.05-0.06 at the crest)
  noteH: [0.015 * SCREEN, 0.021 * SCREEN] as const, // thickness at the crest and at the bar
  backAlpha: 0.4, // notes on the back slope are dim (visual: 30-50%) and brighten at the crest
  uSpan: 0.85, // a choice (decision stage-view-geometry): the chart's pitch range covers this much of the half-field
  minHalfRange: 12, // a choice: a narrow song isn't spread to the edges
};

// The field's width at a frame y, as a fraction of the screen's width: beat-line extents, max residual 0.005.
export const fieldWidth = (yFrame: number) => 0.589 + 0.9625 * yFrame - 0.4543 * yFrame * yFrame;

// The frame y of a note `ms` before its hit. The front face (crest to bar) is the fit y = 0.5606 + 2.083τ + 2.095τ²
// (τ in s, negative, max residual 0.0035); the back slope (first sighting to crest) is a fit to one note's rise,
// y = 0.0592 + 0.1548τ + 0.2545τ² (max residual 0.002). Both meet the crest at τ = -0.497 s.
export function frameY(ms: number): number {
  const t = -ms / 1000;
  return ms <= stageLane.crestMs ? 0.5606 + 2.083 * t + 2.095 * t * t : 0.0592 + 0.1548 * t + 0.2545 * t * t;
}

// Where a pitch sits across the field: u in [-uSpan, uSpan], low on the left, from the chart's own range.
export function pitchU(pitch: number, low: number, high: number): number {
  const half = Math.max((high - low) / 2, stageLane.minHalfRange);
  return ((pitch - (low + high) / 2) / half) * stageLane.uSpan;
}

// A note at u, `ms` before its hit, in screen fractions: its centre, width, thickness and opacity. Null before it shows
// or once it's past the bar. A note keeps its u all the way down (u constant to ±0.002), so its path arches out.
export function notePoint(u: number, ms: number): { x: number; y: number; w: number; h: number; alpha: number } | null {
  if (ms > stageLane.approachMs || ms < 0) return null;
  const yf = frameY(ms);
  const W = fieldWidth(yf);
  const front = ms <= stageLane.crestMs ? 1 - ms / stageLane.crestMs : 0; // 0 at the crest, 1 at the bar
  const [h0, h1] = stageLane.noteH;
  return { x: 0.5 + (u * W) / 2, y: yf * SCREEN, w: stageLane.noteW * W, h: h0 + (h1 - h0) * front, alpha: ms <= stageLane.crestMs ? 1 : stageLane.backAlpha };
}

// The field's edge at a screen y on the front face, for the guides and the hill: x of u = ±1.
export const edgeX = (yScreen: number, side: -1 | 1) => 0.5 + (side * fieldWidth(yScreen / SCREEN)) / 2;
