// Find's reflow (spec: select-motion, 5): rows that stay glide from where they were to where they are, rows that arrive
// fade in, rows that leave just go. Measure before the state changes, play after the commit. Each keystroke measures
// the rows mid-glide (a rect includes the running translate) and starts again from there, so typing never waits. It
// animates translate, not transform, so it composes with the focus bar's own transform.

export const flipSettings = { ms: 180, arriveMs: 120, omega: 40 }; // ω 40: under 1% left at 180 ms

type Rect = { top: number; left: number };
export interface FlipEl {
  dataset: { testid?: string };
  getBoundingClientRect(): Rect;
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): unknown;
  getAnimations(): { id: string; cancel(): void }[];
}

const keyOf = (el: FlipEl) => el.dataset.testid ?? "";

export const measure = (els: Iterable<FlipEl>) => new Map([...els].map((el) => [keyOf(el), el.getBoundingClientRect()] as const));

// Where each staying row has to start from, and which rows are new.
export function invert(before: Map<string, Rect>, after: Map<string, Rect>) {
  const moves: { key: string; dx: number; dy: number }[] = [];
  const arrivals: string[] = [];
  for (const [key, b] of after) {
    const a = before.get(key);
    if (!a) arrivals.push(key);
    else if (Math.abs(a.left - b.left) >= 0.5 || Math.abs(a.top - b.top) >= 0.5) moves.push({ key, dx: a.left - b.left, dy: a.top - b.top });
  }
  return { moves, arrivals };
}

// The spring's own curve as a CSS easing, so the glide moves like the bar: 1 − (1 + ωt)e^(−ωt), sampled.
export const springEasing = (() => {
  const T = flipSettings.ms / 1000;
  const pts = Array.from({ length: 13 }, (_, i) => {
    const t = (i / 12) * T;
    const w = flipSettings.omega;
    return (i === 12 ? 1 : 1 - (1 + w * t) * Math.exp(-w * t)).toFixed(3);
  });
  return `linear(${pts.join(", ")})`;
})();

const ID = "select-flip";

// After the commit: stop the last glide, measure the new layout, and glide from the old rects.
export function play(before: Map<string, Rect>, els: FlipEl[]) {
  for (const el of els) for (const a of el.getAnimations()) if (a.id === ID) a.cancel();
  const byKey = new Map(els.map((el) => [keyOf(el), el]));
  const { moves, arrivals } = invert(before, measure(els));
  for (const { key, dx, dy } of moves)
    byKey.get(key)!.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: flipSettings.ms, easing: springEasing, id: ID });
  for (const key of arrivals) byKey.get(key)!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: flipSettings.arriveMs, easing: "ease-out", id: ID });
  return { moves: moves.length, arrivals: arrivals.length };
}
