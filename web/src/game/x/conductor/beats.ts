// Conductor's beat detector (spike: conductor): a beat is the first low point of the wrist after a fast downward
// stroke. Speeds are in hand sizes per second, so the distance from the camera doesn't matter. Pure.
export const beatSettings = {
  minSpeed: 2.5, // hand sizes per second, downward: a stroke, not a drift (logged in decisions/conductor-thresholds)
  riseHands: 0.15, // the low point is confirmed once the wrist has risen this far back up
  minGapMs: 250, // beats closer than this are one beat
};

export interface Sample {
  t: number; // ms (the camera frame's time)
  y: number; // wrist height in image coordinates, 0 top to 1 bottom: larger is lower
  size: number; // the hand's size in the same units (wrist to middle-finger knuckle)
}

export interface Beat {
  t: number; // ms of the low point
  stroke: number; // the stroke's depth in hand sizes, from its top to its low point
}

export function beatDetector(s = beatSettings) {
  let prev: Sample | null = null;
  let top: number | null = null; // highest point (smallest y) since the last low point
  let armed = false; // a fast downward stroke is under way
  let low: Sample | null = null;
  let lastBeat = -Infinity;
  return {
    // One camera frame; returns the beat it confirms, if any.
    push(p: Sample): Beat | null {
      let beat: Beat | null = null;
      if (prev && p.t > prev.t && p.size > 0) {
        const speed = ((p.y - prev.y) / p.size / (p.t - prev.t)) * 1000; // + is downward
        if (speed >= s.minSpeed) armed = true;
        if (armed) {
          if (!low || p.y >= low.y) low = p;
          else if ((low.y - p.y) / p.size >= s.riseHands) {
            if (low.t - lastBeat >= s.minGapMs) {
              beat = { t: low.t, stroke: top === null ? 0 : (low.y - top) / low.size };
              lastBeat = low.t;
            }
            armed = false;
            low = null;
            top = p.y;
          }
        }
      }
      if (!armed && (top === null || p.y < top)) top = p.y;
      prev = p;
      return beat;
    },
  };
}

// A fist: every fingertip folded close to the palm. Landmarks are MediaPipe's 21 hand points (0 wrist, 9 the middle
// finger's knuckle; tips 8, 12, 16, 20 and their knuckles 5, 9, 13, 17).
export const fistSettings = { foldedRatio: 1.0 }; // tip-to-wrist under this × knuckle-to-wrist counts as folded
export function isFist(lm: readonly { x: number; y: number }[], s = fistSettings): boolean {
  if (lm.length < 21) return false;
  const d = (a: number, b: number) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);
  return [
    [8, 5],
    [12, 9],
    [16, 13],
    [20, 17],
  ].every(([tip, knuckle]) => d(tip, 0) < s.foldedRatio * d(knuckle, 0));
}
