// Take MIDI: the results screen saves the take as a Standard MIDI File (spec: take-midi). Written by hand: format 0,
// one track, 480 ticks per quarter note, exactly the presses played. Nothing quantized, no chart notes.
import { createElement } from "react";
import type { Chart, GamePlugin, Take, TakeEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { pianoOutSettings } from "../piano-out";
import { DownloadMidi } from "./button";

export const PPQ = 480;
export const MARKER = "bar 1"; // marks chart time 0's tick

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
    const off = Math.max(on, tick(e.offTimeMs ?? e.timeMs + ((take.scoringVersion ?? 1) >= 2 ? 0 : pianoOutSettings.heldMs)));
    return [
      { at: on, rank: 1, bytes: [0x90, e.pitch, e.velocity] },
      { at: off, rank: off === on ? 2 : 0, bytes: [0x80, e.pitch, 0] },
    ];
  });
  // A Marker at chart time 0's tick ("bar 1"), so a reader can undo the whole-bar shift (hero-replay).
  const marker = [...new TextEncoder().encode(MARKER)];
  notes.push({ at: tick(0), rank: -1, bytes: [0xff, 0x06, ...vlq(marker.length), ...marker] });
  if ((take.scoringVersion ?? 1) >= 2) {
    const policy = [...new TextEncoder().encode(`pianoArcade scoring ${take.scoringVersion}`)];
    notes.push({ at: tick(0), rank: -1, bytes: [0xff, 0x06, ...vlq(policy.length), ...policy] });
  }
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

// The inverse of takeToMidi, for hero-replay: every press with its velocity, and timeMs and offTimeMs on the chart
// clock (within half a tick). The marker's tick is chart time 0; a file without one reads tick 0 as 0 (marker: false).
// Refused, with the reason: bytes that don't parse, a track name that isn't the chart's title, or another tempo.
export function readTakeMidi(
  bytes: Uint8Array,
  chart: Chart,
): { events: TakeEvent[]; marker: boolean; scoringVersion: 1 | 2 | 3 } | { error: string } {
  const b = bytes;
  const str = (i: number) => String.fromCharCode(...b.subarray(i, i + 4));
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (b.length < 22 || str(0) !== "MThd" || str(14) !== "MTrk") return { error: "not a take file (no MIDI header)" };
  const ppq = (b[12] << 8) | b[13];
  const end = 22 + u32(18);
  if (!ppq || ppq & 0x8000 || end > b.length) return { error: "the file is cut short or uses SMPTE time" };

  let i = 22;
  let tick = 0;
  let status = 0;
  let name: string | null = null;
  let usPerQuarter: number | null = null;
  let markerTick: number | null = null;
  let scoringVersion: 1 | 2 | 3 = 1;
  const ons: { pitch: number; velocity: number; tick: number; off: number | null }[] = [];
  const held = new Map<number, number[]>(); // pitch -> indexes of presses not yet released, oldest first
  const num = () => {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      if (i >= end) throw new Error("cut short");
      const v = b[i++];
      n = n * 128 + (v & 0x7f);
      if (!(v & 0x80)) return n;
    }
    throw new Error("bad length");
  };
  try {
    while (i < end) {
      tick += num();
      if (b[i] & 0x80) status = b[i++];
      if (status === 0xff) {
        const type = b[i++];
        const len = num();
        const data = b.subarray(i, (i += len));
        if (i > end) throw new Error("cut short");
        if (type === 0x03) name = new TextDecoder().decode(data);
        if (type === 0x51 && len === 3) usPerQuarter = (data[0] << 16) | (data[1] << 8) | data[2];
        if (type === 0x06 && new TextDecoder().decode(data) === MARKER) markerTick ??= tick;
        if (type === 0x06 && new TextDecoder().decode(data).startsWith("pianoArcade scoring ")) {
          const policy = new TextDecoder().decode(data);
          if (policy !== "pianoArcade scoring 1" && policy !== "pianoArcade scoring 2" && policy !== "pianoArcade scoring 3") return { error: "unsupported take scoring policy" };
          scoringVersion = Number(policy.slice(-1)) as 1 | 2 | 3;
        }
        if (type === 0x2f) break;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        i += num(); // sysex: skipped
        continue;
      }
      const kind = status & 0xf0;
      const size = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
      const [pitch, velocity] = [b[i], b[i + 1]];
      i += size;
      if (i > end) throw new Error("cut short");
      if (kind === 0x90 && velocity > 0) {
        held.set(pitch, [...(held.get(pitch) ?? []), ons.length]);
        ons.push({ pitch, velocity, tick, off: null });
      } else if (kind === 0x80 || kind === 0x90) {
        const open = held.get(pitch);
        const at = open?.shift();
        if (at !== undefined) ons[at].off = tick;
      }
    }
  } catch {
    return { error: "the file is cut short or malformed" };
  }
  if (name !== chart.title) return { error: `it's a take of "${name ?? "?"}", not "${chart.title}"` };
  const beat = msPerBeat(chart.bpm);
  if (usPerQuarter !== Math.round(beat * 1000))
    return { error: `its tempo (${usPerQuarter ? Math.round(60e6 / usPerQuarter) : "?"} BPM) isn't the chart's ${chart.bpm} BPM` };
  const zero = markerTick ?? 0;
  const ms = (t: number) => ((t - zero) * beat) / ppq;
  return {
    events: ons.map((n) => ({ pitch: n.pitch, velocity: n.velocity, timeMs: ms(n.tick), offTimeMs: n.off === null ? null : ms(n.off) })),
    marker: markerTick !== null,
    scoringVersion,
  };
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
