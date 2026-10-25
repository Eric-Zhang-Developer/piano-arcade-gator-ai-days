// Blue Fever's seam: fever-arc writes the beat the gauge filled a second time on; readers that can't import fever-arc
// (the HUD: it would pull results-landing's React into the server graph) read it here. No imports, on purpose.
let blueAtMs: number | null = null;
export const setBlueAt = (ms: number | null): void => {
  blueAtMs = ms;
};
/** How blue fever is at nowMs, 0–1, over overMs from the upgrade beat; 0 before it or without one. */
export const blueAt = (nowMs: number, overMs: number): number =>
  blueAtMs === null || nowMs < blueAtMs ? 0 : Math.min(1, (nowMs - blueAtMs) / overMs);
/** The upgrade beat, for a one-shot ghost; null without one. */
export const blueStart = (): number | null => blueAtMs;
