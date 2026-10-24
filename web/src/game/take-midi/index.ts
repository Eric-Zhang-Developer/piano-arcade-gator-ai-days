// Take MIDI: the results screen saves the take as a Standard MIDI File (spec: take-midi). Written by hand: format 0,
// one track, 480 ticks per quarter note, exactly the presses played. Nothing quantized, no chart notes.
import { createElement } from "react";
import type { Chart, GamePlugin, Take } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { pianoOutSettings } from "../piano-out";
import { DownloadMidi } from "./button";

export const PPQ = 480;

// Variable-length quantity: 7 bits per byte, most significant first, the high bit set on all but the last.
export function vlq(n: number): number[] {
  const out = [n & 0x7f];
  while ((n >>>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

// beatsPerBar counts quarter notes: 4 -> 4/4, 3 -> 3/4, 1.5 -> 3/8. Halve the note value until the count is whole.
export function timeSignature(beatsPerBar: number): [number, number] {
  let num = beatsPerBar;
  let den = 4;
  while (!Number.isInteger(num) && den < 64) [num, den] = [num * 2, den * 2];
  return [Math.round(num), den];
}

export function takeToMidi(chart: Chart, take: Take): Uint8Array {
  const beat = msPerBeat(chart.bpm);
  const presses = take.events.filter((e) => e.velocity > 0);
  // Tick 0 is chart time 0. A press in the count-in shifts everything later by whole bars, so bars still line up.
  const barMs = chart.beatsPerBar * beat;
  const first = Math.min(0, ...presses.map((e) => e.timeMs));
  const shiftMs = first < 0 ? Math.ceil(-first / barMs) * barMs : 0;
  const tick = (ms: number) => Math.round(((ms + shiftMs) * PPQ) / beat);

  // rank breaks ties at one tick: a release first, so a re-pressed key sounds again; a note's own release always
  // after its press, even when they round to the same tick.
  const notes = presses.flatMap((e) => {
    const on = tick(e.timeMs);
    const off = Math.max(on, tick(e.offTimeMs ?? e.timeMs + pianoOutSettings.heldMs));
    return [
      { at: on, rank: 1, bytes: [0x90, e.pitch, e.velocity] },
      { at: off, rank: off === on ? 2 : 0, bytes: [0x80, e.pitch, 0] },
    ];
  });
  notes.sort((a, b) => a.at - b.at || a.rank - b.rank);

  const name = [...new TextEncoder().encode(chart.title)];
  const [num, den] = timeSignature(chart.beatsPerBar);
  const usPerQuarter = Math.round(beat * 1000);
  const track: number[] = [
    0, 0xff, 0x03, ...vlq(name.length), ...name,
    0, 0xff, 0x51, 0x03, ...u32(usPerQuarter).slice(1),
    0, 0xff, 0x58, 0x04, num, Math.log2(den), 24, 8,
  ];
  let last = 0;
  for (const n of notes) {
    track.push(...vlq(n.at - last), ...n.bytes);
    last = n.at;
  }
  track.push(0, 0xff, 0x2f, 0x00);

  const header = [..."MThd"].map((c) => c.charCodeAt(0)).concat(u32(6), [0, 0, 0, 1, PPQ >> 8, PPQ & 0xff]);
  const chunk = [..."MTrk"].map((c) => c.charCodeAt(0)).concat(u32(track.length), track);
  return Uint8Array.from([...header, ...chunk]);
}

// <chart id>-<YYYYMMDD-HHmm>.mid, from startedAt on the player's clock; a "/" in the id becomes "-".
export function midiFileName(take: Take): string {
  const d = new Date(take.startedAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `${take.chartId.replaceAll("/", "-")}-${stamp}.mid`;
}

export function takeMidi(): GamePlugin {
  return {
    id: "take-midi",
    resultsPanel: ({ chart, take }) => (take.events.some((e) => e.velocity > 0) ? createElement(DownloadMidi, { chart, take }) : null),
  };
}
