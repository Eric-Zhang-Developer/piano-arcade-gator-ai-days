// Record seams (spec: record-seams): where a song's own recording starts and stops, as film's J- and L-cuts. Pure:
// audio-track schedules what this plans. All times are chart ms (0 is the first downbeat) unless named file ms.
import { msPerBeat } from "../core/settings";

export const seamSettings = {
  duckDb: -6, // the tail under the results, against its take level
  duckMs: 200, // songEnd to the ducked level: a slide, not a step
  fadeBars: 2,
  playOutMs: 12_000, // the recording's natural end within this of songEnd: it plays out, no fade
  floorDb: -60, // the fade runs down to this, under the duck, then the gain goes to 0 on the bar line
};

export type TailPlan =
  | { kind: "none" } // the recording has already ended (or this take has no tail)
  | { kind: "play-out"; startMs: number; endMs: number } // endMs: the file's own end
  | { kind: "fade"; startMs: number; fadeStartMs: number; endMs: number; bar: number }; // endMs on a bar line; bar: the bar that line starts

export interface TailInput {
  endMs: number; // songEnd
  bpm: number;
  beatsPerBar: number;
  naturalEndMs: number; // the file's end, in chart time
}

const dbGain = (db: number) => 10 ** (db / 20);
export const duckGain = dbGain(seamSettings.duckDb);

// The L-cut. The fade starts on the first bar line at or after songEnd and ends fadeBars later, on a bar line. A
// recording that ends on its own soon after (or inside the fade) plays out instead.
export function planTail({ endMs, bpm, beatsPerBar, naturalEndMs }: TailInput): TailPlan {
  if (!(naturalEndMs > endMs)) return { kind: "none" };
  const barMs = beatsPerBar * msPerBeat(bpm);
  const fadeStartMs = Math.ceil(endMs / barMs - 1e-9) * barMs;
  const fadeEndMs = fadeStartMs + seamSettings.fadeBars * barMs;
  if (naturalEndMs - endMs <= seamSettings.playOutMs || naturalEndMs <= fadeEndMs) return { kind: "play-out", startMs: endMs, endMs: naturalEndMs };
  return { kind: "fade", startMs: endMs, fadeStartMs, endMs: fadeEndMs, bar: Math.round(fadeEndMs / barMs) + 1 };
}

// The tail's gain against the take level, as Web Audio automation: each point is reached at ms by its ramp from the
// one before ("set" jumps there at ms).
export type Ramp = "set" | "linear" | "exp";
export interface GainPoint {
  ms: number;
  gain: number;
  ramp: Ramp;
}

export function tailEnvelope(plan: TailPlan): GainPoint[] {
  if (plan.kind === "none") return [];
  const { duckMs, floorDb } = seamSettings;
  const ducked = plan.startMs + duckMs;
  const pts: GainPoint[] = [
    { ms: plan.startMs, gain: 1, ramp: "set" },
    { ms: ducked, gain: duckGain, ramp: "linear" },
  ];
  if (plan.kind === "fade") {
    // In dB, evenly: a linear-gain fade drops its last 50 ms by more than 20 dB, which is the chop this exists to avoid.
    pts.push({ ms: Math.max(plan.fadeStartMs, ducked), gain: duckGain, ramp: "linear" });
    pts.push({ ms: plan.endMs, gain: duckGain * dbGain(floorDb), ramp: "exp" });
  }
  pts.push({ ms: plan.endMs, gain: 0, ramp: "set" });
  return pts;
}

// The envelope's gain at ms, as Web Audio would play it; 1 before the first point.
export function gainAt(pts: GainPoint[], ms: number): number {
  const i = pts.findLastIndex((p) => p.ms <= ms);
  if (i < 0) return 1;
  const [a, b] = [pts[i], pts[i + 1]];
  if (!b || b.ramp === "set") return a.gain;
  const u = (ms - a.ms) / (b.ms - a.ms);
  return b.ramp === "linear" ? a.gain + (b.gain - a.gain) * u : a.gain * (b.gain / a.gain) ** u;
}

// The J-cut. The recording's intro (file 0 to fileOffsetMs) sounds under the count-in's lead; when it's longer, the
// recording joins mid-intro (audio-track clamps), because /play's lead can't grow yet (#600 holds it).
export function introFit(bpm: number, countInBeats: number, fileOffsetMs: number) {
  const leadMs = countInBeats * msPerBeat(bpm);
  return { leadMs, introMs: fileOffsetMs, firstSoundMs: -fileOffsetMs, joinsMidIntro: fileOffsetMs > leadMs };
}

// The worst gap, in ms, between each count-in click (chart ms) and the recording's own beat nearest it (file ms).
export function clickDrift(clicksMs: number[], fileOffsetMs: number, beatsFileMs: number[]): number {
  let worst = 0;
  for (const c of clicksMs) {
    const f = c + fileOffsetMs;
    worst = Math.max(worst, Math.min(...beatsFileMs.map((b) => Math.abs(b - f))));
  }
  return worst;
}

// A recording to test against, made at test time (decision audio-track-fixture, option B; no audio is committed): a
// click on every beat from the file's start, a steady tone from the first downbeat, and an end that dies away over
// decayMs, like a held last chord.
export interface Fixture {
  sampleRate: number;
  samples: Float32Array<ArrayBuffer>;
  offsetMs: number; // the file time of chart 0
  beatsMs: number[]; // file times of its beats, intro included
  durationMs: number;
}
export function makeFixture({ sampleRate = 48_000, bpm = 120, offsetMs = 1500, songMs = 8000, decayMs = 1500 } = {}): Fixture {
  const mpb = msPerBeat(bpm);
  const durationMs = offsetMs + songMs + decayMs;
  const n = Math.round((durationMs * sampleRate) / 1000);
  const samples = new Float32Array(n);
  const beatsMs: number[] = [];
  for (let b = offsetMs - Math.floor(offsetMs / mpb) * mpb; b < offsetMs + songMs; b += mpb) beatsMs.push(b);
  const clickN = Math.round(sampleRate * 0.01);
  for (const b of beatsMs) {
    const i0 = Math.round((b * sampleRate) / 1000);
    for (let j = 0; j < clickN && i0 + j < n; j++) samples[i0 + j] += 0.3 * (1 - j / clickN) * Math.sin((2 * Math.PI * 1000 * j) / sampleRate);
  }
  const toneFrom = Math.round((offsetMs * sampleRate) / 1000);
  const decayFrom = Math.round(((offsetMs + songMs) * sampleRate) / 1000);
  for (let i = toneFrom; i < n; i++) {
    const fall = i < decayFrom ? 1 : 10 ** ((-60 * (i - decayFrom)) / ((decayMs * sampleRate) / 1000) / 20); // -60 dB over decayMs
    samples[i] += 0.25 * fall * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
  }
  return { sampleRate, samples, offsetMs, beatsMs, durationMs };
}
