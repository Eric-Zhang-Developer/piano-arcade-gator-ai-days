// Real Keys (spec: real-keys): the camera's delay, from one key pressed 8 times. For each MIDI note-on, the first video
// frame where that key's brightness moves past a threshold from its level just before the press; the median of
// (frame time − note-on time) is the overlay's delay.
export const latencySettings = {
  threshold: 12, // luma steps (0–255) from the pre-press level: specs/decisions/real-keys-latency.md
  baselineMs: 150, // the pre-press level: the mean over this long before the note-on
  searchMs: 600, // a frame later than this after the press isn't this press's
};

export interface Sample {
  t: number; // the frame's time, on the same clock as the note-ons (ms)
  b: number; // the key's mean luma in that frame
}

// One delay per press (ms), or null when no frame crossed the threshold in time.
export function pressDelays(frames: Sample[], pressesMs: number[], s = latencySettings): (number | null)[] {
  return pressesMs.map((at) => {
    let sum = 0, n = 0;
    for (const f of frames) if (f.t >= at - s.baselineMs && f.t < at) (sum += f.b), n++;
    if (!n) return null;
    const base = sum / n;
    const hit = frames.find((f) => f.t >= at && f.t <= at + s.searchMs && Math.abs(f.b - base) > s.threshold);
    return hit ? hit.t - at : null;
  });
}

export interface Summary {
  medianMs: number;
  minMs: number;
  maxMs: number;
  frameMs: number;
  spreadFrames: number; // (max − min) in frames
  found: number;
  of: number;
}

export function summarize(delays: (number | null)[], frameMs: number): Summary | null {
  const d = delays.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!d.length) return null;
  const mid = d.length >> 1;
  const medianMs = d.length % 2 ? d[mid] : (d[mid - 1] + d[mid]) / 2;
  return { medianMs, minMs: d[0], maxMs: d[d.length - 1], frameMs, spreadFrames: (d[d.length - 1] - d[0]) / frameMs, found: d.length, of: delays.length };
}
