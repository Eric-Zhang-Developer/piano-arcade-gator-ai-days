import { expect, test } from "vitest";
import { between, GM_ON, readMidi, setup, silence } from "./band.mjs";

// A Standard MIDI File from tracks of [delta ticks, ...bytes] events, end-of-track added.
const vlq = (v: number) => {
  const out = [v & 0x7f];
  while ((v >>= 7)) out.unshift((v & 0x7f) | 0x80);
  return out;
};
const u32 = (v: number) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function smf(tracks: number[][][], { format = 1, division = 480 } = {}) {
  const head = [..."MThd"].map((c) => c.charCodeAt(0)).concat(u32(6), [0, format, 0, tracks.length, division >> 8, division & 255]);
  return new Uint8Array(
    tracks.reduce((all, evs) => {
      const body = evs.flatMap(([delta, ...bytes]) => [...vlq(delta), ...bytes]).concat([0, 0xff, 0x2f, 0]);
      return all.concat([..."MTrk"].map((c) => c.charCodeAt(0)), u32(body.length), body);
    }, head),
  );
}
const tempo = (bpm: number) => {
  const us = Math.round(60e6 / bpm);
  return [0xff, 0x51, 3, us >> 16, (us >> 8) & 255, us & 255];
};

// Conductor: 120 bpm, then 60 bpm from beat 2. Band: a note on each beat 0–3 on channel 2, running status, vel-0 offs.
const conductor = [[0, ...tempo(120)], [960, ...tempo(60)]];
const band = [
  [0, 0xc1, 33],
  [0, 0x91, 40, 90], [240, 40, 0], // running status: note-on 40, then its velocity-0 off
  [240, 41, 90], [240, 41, 0],
  [240, 42, 90], [240, 42, 0],
  [240, 43, 90], [240, 43, 0],
];
const file = readMidi(smf([conductor, band]));
const ons = (evs: { atMs: number; data: number[] }[]) => evs.filter((e) => (e.data[0] & 0xf0) === 0x90);

test("format 1: a conductor track's two tempos land each note at its ms", () => {
  expect(ons(file.events).map((e) => [e.data[1], e.atMs])).toEqual([[40, 0], [41, 500], [42, 1000], [43, 2000]]);
  expect(file.beatMs).toBe(500);
  expect(file.endMs).toBe(2500);
  expect(file.channels).toEqual([2]);
});

test("running status parses, and a velocity-0 note-on becomes a note-off", () => {
  expect(file.events.filter((e) => e.data[0] === 0x81).map((e) => e.data)).toEqual([[0x81, 40, 0], [0x81, 41, 0], [0x81, 42, 0], [0x81, 43, 0]]);
});

test("refuses SMPTE, format 2, a cut-short file and a non-MIDI file, with a reason", () => {
  expect(() => readMidi(smf([band], { division: 0xe728 }))).toThrow("SMPTE");
  expect(() => readMidi(smf([band], { format: 2 }))).toThrow("format 2");
  const whole = smf([conductor, band]);
  expect(() => readMidi(whole.slice(0, whole.length - 10))).toThrow("cut short");
  expect(() => readMidi(new TextEncoder().encode("not a midi file at all"))).toThrow("not a MIDI file");
});

test("meta and SysEx are skipped; channel 1 notes are counted", () => {
  const f = readMidi(smf([[[0, 0xf0, 3, 0x7e, 0x09, 0xf7], [0, 0xff, 0x03, 2, 0x41, 0x42], [0, 0xc0, 0], [0, 0x90, 60, 80], [480, 0x80, 60, 0], [0, 0x99, 36, 100]]], { format: 0 }));
  expect(f.events.map((e) => e.data)).toEqual([[0xc0, 0], [0x90, 60, 80], [0x80, 60, 0], [0x99, 36, 100]]);
  expect(f.channel1Notes).toBe(1);
  expect(f.channels).toEqual([1, 10]);
});

const at = (atMs: number, data: number[]) => ({ atMs, data });

test("at tempo 70%, a file event at 1,000 ms plays at 1,428.6 ms", () => {
  const got = between([at(1000, [0x91, 40, 90])], 0, 5000, { tempo: 70 });
  expect(got).toHaveLength(1);
  expect(got[0].atMs).toBeCloseTo(1428.6, 1);
});

test("a loop from bar 5 at 100 bpm: the event at 9,600 ms plays at chart 0 and again at passMs", () => {
  const events = [at(2000, [0xc1, 48]), at(9000, [0x91, 39, 90]), at(9600, [0x91, 40, 90]), at(14000, [0x91, 41, 90])];
  const loop = { seekMs: 9600, untilMs: 12000, passMs: 4800, passes: 2 };
  expect(between(events, -1000, 20000, loop)).toEqual([at(0, [0x91, 40, 90]), at(4800, [0x91, 40, 90])]);
  expect(setup(events, 9600)).toEqual([[0xc1, 48]]);
});

test("consecutive windows return every event exactly once, at any tempo and across passes", () => {
  const events = Array.from({ length: 200 }, (_, i) => at(i * 37, [0x91, 40 + (i % 20), 90]));
  for (const opts of [{}, { tempo: 70 }, { tempo: 115, seekMs: 1000, untilMs: 5000, passMs: 4000, passes: 3 }]) {
    const all = between(events, -Infinity, Infinity, opts);
    const windows = [];
    for (let t = -500; t < 20000; t += 16.7) windows.push(...between(events, t, t + 16.7, opts));
    expect(windows).toEqual(all);
  }
});

test("setup chases each channel's last program and controllers at the seek point, pedal excepted", () => {
  const events = [at(0, [0xc1, 33]), at(0, [0xb1, 7, 100]), at(500, [0xb1, 64, 127]), at(800, [0xb1, 7, 80]), at(900, [0xc9, 0]), at(1200, [0xc1, 38])];
  expect(setup(events, 1000)).toEqual([[0xc1, 33], [0xb1, 7, 80], [0xc9, 0]]);
});

test("silence: All Notes Off and pedal up on each channel listed, and GM On is the GM System On message", () => {
  expect(silence([2, 10])).toEqual([[0xb1, 123, 0], [0xb1, 64, 0], [0xb9, 123, 0], [0xb9, 64, 0]]);
  expect(GM_ON).toEqual([0xf0, 0x7e, 0x7f, 0x09, 0x01, 0xf7]);
});
