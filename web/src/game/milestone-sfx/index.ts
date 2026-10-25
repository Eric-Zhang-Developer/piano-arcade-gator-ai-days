// Milestone SFX (spec: milestone-sfx): when the clear card's and NEW RECORD's sounds land, and the loudness rule that
// keeps every milestone sound off a recording's loud stretches. Pure; juice-sound's scheduler (../sound) calls it, so
// one place still schedules every sound. The voices are in ./voices.
import type { GameEvent } from "../../contracts";
import { clearKind, type ClearKind } from "../clear-card";
import { impactT } from "../rank-stamp";
import { momentSettings, momentTimes } from "../record-moment/timing";

export type ClearVoice = "clear" | "fullComboCard" | "allPerfect";
export const CLEAR_VOICE: Record<ClearKind, ClearVoice> = {
  CLEAR: "clear",
  "FULL COMBO": "fullComboCard",
  "ALL PERFECT": "allPerfect",
};

// The clear card's moment: the event that judges the chart's last note, as clear-card shows it. Once per take.
export function clearWatch(notes: number): (e: GameEvent) => ClearKind | null {
  let counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 };
  let shown = false;
  return (e) => {
    if (e.type === "songStart" || e.type === "quit" || e.type === "songEnd") {
      counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 };
      shown = false;
      return null;
    }
    if (e.type === "noteHit") counts[e.judgment]++;
    else if (e.type === "noteMiss") counts.MISS++;
    else if (e.type === "wrongNote") counts.wrong++;
    else return null;
    if (shown || counts.PERFECT + counts.GREAT + counts.GOOD + counts.MISS < notes) return null;
    shown = true;
    return clearKind(counts);
  };
}

// NEW RECORD stamps on rank-stamp's curve from record-moment's start: its sound lands at that stamp's impact, in ms
// after songEnd.
export const newRecordImpactMs = () => momentTimes().startMs + Math.round(impactT * momentSettings.stampMs);

// What "loud" is, measured on the Golden recording (specs/decisions/milestone-sfx-loudness.md): RMS in 100 ms windows,
// in dBFS of the file. A sound whose first lookMs touches a window above loudDb plays on time, at softGain.
export const loudnessSettings = { loudDb: -16, softGain: 0.25, lookMs: 300, windowMs: 100 };

// The gain the rule gives a sound at chart time atMs. levelAt is the recording's level there, or null when none plays.
export function loudnessGain(atMs: number, levelAt: (chartMs: number) => number | null): number {
  const { loudDb, softGain, lookMs, windowMs } = loudnessSettings;
  for (let ms = atMs; ms <= atMs + lookMs; ms += windowMs) if ((levelAt(ms) ?? -Infinity) > loudDb) return softGain;
  return 1;
}

// RMS level per windowMs of a decoded recording, in dBFS, its channels averaged (audio-track keeps one per recording).
export function levelEnvelope(
  buf: Pick<AudioBuffer, "numberOfChannels" | "sampleRate" | "length" | "getChannelData">,
): Float32Array {
  const w = Math.round((buf.sampleRate * loudnessSettings.windowMs) / 1000);
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  const out = new Float32Array(Math.floor(buf.length / w));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let j = i * w; j < (i + 1) * w; j++) {
      let x = 0;
      for (const ch of chans) x += ch[j];
      x /= chans.length;
      sum += x * x;
    }
    out[i] = 20 * Math.log10(Math.max(Math.sqrt(sum / w), 1e-6));
  }
  return out;
}
