// The round's echo engine (spec: round), pure: what to send for voices 2–4, and which input notes are the piano
// echoing those sends back. index.ts does the clock, the MIDI and the drawing.
import type { Chart } from "../../../contracts";
import { msPerBeat } from "../../core/settings";
import { echoGuard } from "../../hand-mode";

export const roundSettings = {
  // Where voice 2 comes in, per chart, from each source's own marks (decision round-entries).
  entries: {
    "frere-jacques": { everyBars: 2, voices: 4 },
    "row-your-boat": { everyBars: 2, voices: 4 },
  } as Record<string, { everyBars: number; voices: number }>,
  // General MIDI programs (1-based) for voices 2, 3 and 4: the pitch's starting points, strings, flute, choir aahs.
  // Not yet picked by ear on the DGX (decision round-voices; Eric's morning page).
  programs: [49, 74, 53],
  lookaheadMs: 300, // as beat-track: a Stop or a pause leaves at most this much already sent
  echoWindowMs: 5, // the echo guard's window: a round puts one pitch in two voices on purpose (decision round-voices)
};

export interface Played {
  type: "on" | "off";
  pitch: number;
  velocity: number;
  atMs: number; // chart time
}

export interface Send {
  bytes: number[];
  atMs: number; // chart time
  voice: number; // 2, 3 or 4
}

// The chart's round, or null when it has none: the take then plays as a normal song.
export function entryFor(chart: Chart): { intervalMs: number; voices: number } | null {
  const e = roundSettings.entries[chart.id];
  return e ? { intervalMs: e.everyBars * chart.beatsPerBar * msPerBeat(chart.bpm), voices: e.voices } : null;
}

// Voice k + 1 plays the player's event k intervals later, on MIDI channel k + 1 (status nibble k). Only the sends due
// in [fromMs, toMs), so a caller that asks window by window sends each one once, and nothing past the window.
export function echoes(played: Played[], intervalMs: number, voices: number, fromMs: number, toMs: number): Send[] {
  const out: Send[] = [];
  for (const p of played)
    for (let k = 1; k < voices; k++) {
      const atMs = p.atMs + k * intervalMs;
      if (atMs < fromMs || atMs >= toMs) continue;
      out.push({ bytes: [(p.type === "on" ? 0x90 : 0x80) | k, p.pitch, p.type === "on" ? p.velocity : 0], atMs, voice: k + 1 });
    }
  return out.sort((a, b) => a.atMs - b.atMs);
}

// The program for each echo voice, sent at the take's start.
export const programChanges = (voices: number): number[][] =>
  roundSettings.programs.slice(0, voices - 1).map((program, i) => [0xc0 | (i + 1), program - 1]);

// Pedal up (CC64 0) and All Notes Off (CC123) on every channel the round uses: 1 for the player, 2 to voices.
export const silence = (voices: number): number[][] =>
  Array.from({ length: voices }, (_, ch) => [[0xb0 | ch, 64, 0], [0xb0 | ch, 123, 0]]).flat();

// The DGX echoes received MIDI back out (#429). Core's input carries no channel, so a second read-only listener on the
// same port notes every note-on on channels 2–16 by its timestamp; a note-on core passes with the same pitch and
// timestamp is that echo. A channel-1 copy is caught by the echo guard: same pitch, within echoWindowMs of a send.
export function echoFilter(windowMs = roundSettings.echoWindowMs) {
  const guard = echoGuard(windowMs);
  const foreign: { pitch: number; timeStamp: number }[] = [];
  const dropped = new Set<number>(); // pitches whose note-on was dropped, so their note-off is dropped too
  let received = 0;
  let filtered = 0;
  return {
    heard(status: number, pitch: number, velocity: number, timeStamp: number) {
      if ((status & 0xf0) !== 0x90 || velocity === 0 || (status & 0x0f) === 0) return;
      received++;
      foreign.push({ pitch, timeStamp });
      if (foreign.length > 256) foreign.splice(0, foreign.length - 256);
    },
    sent: guard.sent,
    // true: drop it. Called for every input event, in order.
    drop(type: "on" | "off", pitch: number, timeMs: number): boolean {
      if (type === "off") return dropped.delete(pitch);
      const echo = foreign.some((f) => f.pitch === pitch && Math.abs(f.timeStamp - timeMs) < 0.5) || guard.isEcho(pitch, timeMs);
      if (echo) {
        dropped.add(pitch);
        filtered++;
      }
      return echo;
    },
    counts: () => ({ received, filtered }),
    clear() {
      guard.clear();
      foreign.length = 0;
      dropped.clear();
    },
  };
}
