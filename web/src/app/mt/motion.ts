// The coverflow's motion as pure functions of the fractional position `pos` (spec: menu-test, Motion). The numbers
// are the source component's defaults; the horizontal spacing is ours (decision menu-test-spacing).

export const coverflowSettings = {
  rotate: 44, // degrees of tilt one card away
  maxTilt: 82, // degrees, never edge-on
  depth: 0.6, // card widths pushed back one card away
  perspective: 3, // card widths
  falloff: 0.56, // exponent on |offset|: far cards bunch up
  fade: 0.1, // opacity lost per card away
  gap: 0.05, // card widths between neighbours
  settleMs: 450, // ease-out back to a whole card
  maxFlick: 2, // cards a flick may carry
};

// Card i's offset from the centre, folded the short way round the ring of n cards.
export function foldOffset(i: number, pos: number, n: number): number {
  const o = (((i - pos) % n) + n) % n;
  return o > n / 2 ? o - n : o;
}

export type CardPose = { x: number; z: number; tilt: number; opacity: number; layer: number };

// Where a card sits, in px for a card cardWidth px wide. Fully faded by half a ring away, so the wrap never shows.
export function cardPose(offset: number, n: number, cardWidth: number, s = coverflowSettings): CardPose {
  const a = Math.abs(offset);
  const curve = a ** s.falloff;
  const sign = Math.sign(offset);
  const edge = Math.min(1, Math.max(0, n / 2 - a)); // 1 until one card from the far side, 0 at half a ring
  return {
    x: sign * curve * cardWidth * (1 + s.gap),
    z: -s.depth * cardWidth * curve,
    tilt: -sign * Math.min(s.rotate * curve, s.maxTilt),
    opacity: Math.max(0, Math.min(1 - s.fade * a, edge)),
    layer: 1000 - Math.round(a * 10),
  };
}

// Where a release at `pos` moving `velocity` cards per second comes to rest: a whole card, at most maxFlick away.
export function flickTarget(pos: number, velocity: number, s = coverflowSettings): number {
  const thrown = pos + velocity * 0.25;
  return Math.round(Math.min(pos + s.maxFlick, Math.max(pos - s.maxFlick, thrown)));
}

export const easeOut = (t: number) => 1 - (1 - t) ** 3;

// The song at the centre for a position on a ring of n.
export const centreIndex = (pos: number, n: number) => (((Math.round(pos) % n) + n) % n);
