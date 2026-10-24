// Calibration (spec: calibration): tap along to clicks; the mean of tap - click becomes the latency offset.
// Pure: click times and taps go in, an offset or a reason comes out. Times are performance.now() ms.
import { LATENCY_MAX, LATENCY_MIN, msPerBeat } from "../core/settings";

export const calibrationSettings = {
  clicks: 12,
  bpm: 100,
  settleClicks: 4, // taps on the first clicks are dropped: settling in
  pairMs: 250, // a tap pairs with the nearest click this close
  minTaps: 6,
  maxSpreadMs: 40, // population standard deviation of tap - click
  leadMs: 1200, // from Start to the first click
};

export const clickTimes = (startPerf: number): number[] =>
  Array.from({ length: calibrationSettings.clicks }, (_, i) => startPerf + calibrationSettings.leadMs + i * msPerBeat(calibrationSettings.bpm));

export type Calibration =
  | { ok: true; offsetMs: number; spreadMs: number; taps: number }
  | { ok: false; reason: "too few" | "too spread"; spreadMs: number | null; taps: number };

// Signed like /play: positive means taps arrive late.
export function calibrate(clicks: number[], taps: number[]): Calibration {
  const s = calibrationSettings;
  const diffs: number[] = [];
  for (const t of taps) {
    let best = -1;
    clicks.forEach((c, i) => {
      if (Math.abs(t - c) <= s.pairMs && (best < 0 || Math.abs(t - c) < Math.abs(t - clicks[best]))) best = i;
    });
    if (best >= s.settleClicks) diffs.push(t - clicks[best]);
  }
  if (diffs.length < s.minTaps) return { ok: false, reason: "too few", spreadMs: null, taps: diffs.length };
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const spreadMs = Math.round(Math.sqrt(diffs.reduce((a, d) => a + (d - mean) ** 2, 0) / diffs.length));
  if (spreadMs > s.maxSpreadMs) return { ok: false, reason: "too spread", spreadMs, taps: diffs.length };
  return { ok: true, offsetMs: Math.max(LATENCY_MIN, Math.min(LATENCY_MAX, Math.round(mean))), spreadMs, taps: diffs.length };
}
