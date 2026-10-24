import { expect, test } from "vitest";
import type { Chart, Take, TakeEvent } from "../../contracts";
import { pianoOutSettings } from "../piano-out";
import { midiFileName, takeToMidi, timeSignature, vlq } from ".";

const chart = (beatsPerBar = 4): Chart =>
  ({ id: "twinkle", title: "Twinkle", composer: "trad", source: "x", bpm: 100, beatsPerBar, notes: [] }) as unknown as Chart;
const take = (events: Partial<TakeEvent>[]): Take => ({
  chartId: "classics/twinkle", startedAt: "2026-10-24T09:05:00", latencyOffsetMs: 0, inputDevice: "keys",
  events: events.map((e) => ({ pitch: 60, velocity: 80, timeMs: 0, offTimeMs: null, ...e })),
});

// A tiny reader: the header, then every event in the one track with its absolute tick.
function read(bytes: Uint8Array) {
  const b = [...bytes];
  const str = (i: number) => String.fromCharCode(...b.slice(i, i + 4));
  const u32 = (i: number) => (b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3];
  const header = { id: str(0), length: u32(4), format: (b[8] << 8) | b[9], tracks: (b[10] << 8) | b[11], division: (b[12] << 8) | b[13] };
  expect(str(14)).toBe("MTrk");
  const end = 22 + u32(18);
  expect(end).toBe(b.length);
  let i = 22;
  let tick = 0;
  const num = () => {
    let n = 0;
    while (b[i] & 0x80) n = (n << 7) | (b[i++] & 0x7f);
    return (n << 7) | b[i++];
  };
  const notes: { on: boolean; pitch: number; velocity: number; tick: number }[] = [];
  const meta: Record<number, number[]> = {};
  while (i < end) {
    tick += num();
    const status = b[i++];
    if (status === 0xff) {
      const type = b[i++];
      const len = num();
      meta[type] = b.slice(i, (i += len));
    } else {
      const [pitch, velocity] = [b[i++], b[i++]];
      notes.push({ on: (status & 0xf0) === 0x90, pitch, velocity, tick });
    }
  }
  return { header, notes, meta };
}

test("the header is MThd, length 6, format 0, 1 track, division 480", () => {
  expect(read(takeToMidi(chart(), take([{}]))).header).toEqual({ id: "MThd", length: 6, format: 0, tracks: 1, division: 480 });
});

test("the track names the chart, sets its tempo and time signature, and ends", () => {
  const { meta } = read(takeToMidi(chart(), take([{}])));
  expect(String.fromCharCode(...meta[0x03])).toBe("Twinkle");
  expect((meta[0x51][0] << 16) | (meta[0x51][1] << 8) | meta[0x51][2]).toBe(600_000); // 100 BPM
  expect(meta[0x58].slice(0, 2)).toEqual([4, 2]); // 4/4
  expect(meta[0x2f]).toEqual([]);
  expect(timeSignature(3)).toEqual([3, 4]);
  expect(timeSignature(1.5)).toEqual([3, 8]);
});

test("at 100 BPM, a press at chart time 600 ms lands at tick 480", () => {
  const { notes } = read(takeToMidi(chart(), take([{ timeMs: 600, offTimeMs: 900 }])));
  expect(notes).toEqual([
    { on: true, pitch: 60, velocity: 80, tick: 480 },
    { on: false, pitch: 60, velocity: 0, tick: 720 },
  ]);
});

test("variable-length deltas encode 0, 127, 128, 16 383 and 16 384", () => {
  expect(vlq(0)).toEqual([0x00]);
  expect(vlq(127)).toEqual([0x7f]);
  expect(vlq(128)).toEqual([0x81, 0x00]);
  expect(vlq(16_383)).toEqual([0xff, 0x7f]);
  expect(vlq(16_384)).toEqual([0x81, 0x80, 0x00]);
});

test("a press at -200 ms shifts everything by one bar", () => {
  const { notes } = read(takeToMidi(chart(), take([{ timeMs: -200, offTimeMs: 100 }, { timeMs: 600, offTimeMs: 900 }])));
  const bar = 4 * 480;
  expect(notes.filter((n) => n.on).map((n) => n.tick)).toEqual([bar - 160, bar + 480]);
});

test("a missing release ends heldMs later", () => {
  const { notes } = read(takeToMidi(chart(), take([{ timeMs: 0, offTimeMs: null }])));
  expect(notes.find((n) => !n.on)!.tick).toBe(Math.round((pianoOutSettings.heldMs * 480) / 600));
});

test("the file reads back to the same pitches, velocities and ticks, and nothing else", () => {
  const events = [
    { pitch: 60, velocity: 40, timeMs: 0, offTimeMs: 300 },
    { pitch: 64, velocity: 100, timeMs: 300, offTimeMs: 600 },
    { pitch: 60, velocity: 70, timeMs: 300, offTimeMs: 301 }, // re-pressed as the first ends: its release goes first
    { pitch: 67, velocity: 0, timeMs: 400, offTimeMs: null }, // not a press
  ];
  const { notes } = read(takeToMidi(chart(), take(events)));
  expect(notes).toEqual([
    { on: true, pitch: 60, velocity: 40, tick: 0 },
    { on: false, pitch: 60, velocity: 0, tick: 240 },
    { on: true, pitch: 64, velocity: 100, tick: 240 },
    { on: true, pitch: 60, velocity: 70, tick: 240 },
    { on: false, pitch: 60, velocity: 0, tick: 241 },
    { on: false, pitch: 64, velocity: 0, tick: 480 },
  ]);
});

test("a press and release on one tick: the release still comes after its press", () => {
  const { notes } = read(takeToMidi(chart(), take([{ timeMs: 0, offTimeMs: 0.1 }])));
  expect(notes.map((n) => n.on)).toEqual([true, false]);
});

test("the file name is the chart id with '/' as '-', and startedAt as YYYYMMDD-HHmm", () => {
  expect(midiFileName(take([]))).toBe("classics-twinkle-20261024-0905.mid");
});
