// The fever gauge (spec: fever-gauge). Pure: the judge steps it to decide feverStart, and the meter steps it over
// the events it receives, so the two always agree.
import type { GameEvent } from "../../contracts";

export const feverGaugeSettings = {
  fillShare: 0.25, // the gauge is full at this share of the chart's notes … (tune this before changing the rule)
  minFill: 12, // … but never fewer (Twinkle, 42 notes, fills at 12)
  maxFill: 50, // … nor more
  points: { PERFECT: 1, GREAT: 0.5, GOOD: 0 },
};

export interface Gauge {
  size: number; // points to fill it
  fill: number; // 0…size
  fever: boolean;
}

export function gaugeSize(notes: number): number {
  const { fillShare, minFill, maxFill } = feverGaugeSettings;
  return Math.max(minFill, Math.min(maxFill, Math.round(notes * fillShare)));
}

export const emptyGauge = (notes: number): Gauge => ({ size: gaugeSize(notes), fill: 0, fever: false });

// A full gauge starts fever, which lasts until the combo breaks. Before fever a MISS or WRONG halves the gauge;
// during it, the break ends fever and empties the gauge. Every other event leaves it alone.
export function reduceGauge(g: Gauge, e: GameEvent): Gauge {
  switch (e.type) {
    case "noteHit": {
      if (g.fever) return g;
      const fill = Math.min(g.size, g.fill + feverGaugeSettings.points[e.judgment]);
      return { ...g, fill, fever: fill >= g.size };
    }
    case "noteMiss":
    case "wrongNote":
      return g.fever ? { ...g, fill: 0, fever: false } : { ...g, fill: g.fill / 2 };
    default:
      return g;
  }
}
