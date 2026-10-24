// Hand mode's logic (spec: hand-mode). Pure, so it tests without a page or a piano.
import type { Chart, ChartNote, Hand } from "../../contracts";
import { msPerBeat } from "../core/settings";

export type HandsSetting = Hand | "both";

export const handModeSettings = {
  defaultVelocity: 80, // a note the chart gives no velocity
  echoMs: 30, // a MIDI note-on this close to one we sent, same pitch, is the piano's echo
  toneVolume: 0.12, // laptop tone, 0–1: quieter than the beat's 0.3 click
  toneMaxS: 1.5, // long notes fade by then
};

export const ALL_NOTES_OFF_CH1 = [0xb0, 123, 0];

export function handsSetting(param: string | null): HandsSetting {
  return param === "R" || param === "L" ? param : "both";
}

// The chart to draw and judge, and the notes the piano plays for you. A one-hand chart ignores the setting.
export function splitHands(chart: Chart, hands: HandsSetting): { judged: Chart; playback: ChartNote[] } {
  const both = chart.notes.some((n) => n.hand === "L") && chart.notes.some((n) => n.hand === "R");
  if (hands === "both" || !both) return { judged: chart, playback: [] };
  return {
    judged: { ...chart, notes: chart.notes.filter((n) => n.hand === hands) },
    playback: chart.notes.filter((n) => n.hand !== hands),
  };
}

export interface Playback {
  pitch: number;
  velocity: number;
  atMs: number; // chart time
  endMs: number;
}

// The playback notes starting at fromMs <= atMs < toMs, on the chart clock.
export function playbackBetween(chart: Chart, notes: ChartNote[], fromMs: number, toMs: number): Playback[] {
  const mpb = msPerBeat(chart.bpm);
  return notes
    .map((n) => ({ pitch: n.pitch, velocity: n.velocity ?? handModeSettings.defaultVelocity, atMs: n.beat * mpb, endMs: (n.beat + n.duration) * mpb }))
    .filter((p) => p.atMs >= fromMs && p.atMs < toMs);
}

// Remembers what we sent, so the piano's echo of it isn't judged as an extra.
export function echoGuard(windowMs = handModeSettings.echoMs) {
  const sent: { pitch: number; atPerf: number }[] = [];
  return {
    sent(pitch: number, atPerf: number) {
      sent.push({ pitch, atPerf });
      if (sent.length > 256) sent.splice(0, sent.length - 256);
    },
    isEcho: (pitch: number, atPerf: number) => sent.some((s) => s.pitch === pitch && Math.abs(atPerf - s.atPerf) <= windowMs),
    clear: () => void (sent.length = 0),
  };
}
