import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import type { Chart, Frame } from "../../contracts";
import { beatHits, beatTrack } from ".";
import { pauseClock } from "../play-slots";
import { beatTiming } from "./timing";

const load = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const draw = { fillText() {} } as unknown as CanvasRenderingContext2D;
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// Chart BPM and positions are quarter notes. The sourced Nocturne meter is 12/8:
// four dotted-quarter pulses per six-quarter bar, not six quarter-note clicks.
test.each([100, 70])("Nocturne at %s percent has four equally spaced pulses per bar and a two-bar count-in", (percent) => {
  const chart = load("nocturne-op9-2");
  chart.bpm *= percent / 100;
  const quarterMs = 60000 / chart.bpm;
  const hits = beatHits(chart, -Infinity, 6 * quarterMs);
  expect(hits.filter(h => h.note === 37).map(h => h.atMs / quarterMs)).toEqual([-12, -10.5, -9, -7.5, -6, -4.5, -3, -1.5]);
  expect(hits.filter(h => h.note === 42).map(h => h.atMs / quarterMs)).toEqual([0, 1.5, 3, 4.5]);
  expect(hits.filter(h => h.accent && h.note !== 36).map(h => h.atMs / quarterMs)).toEqual([-12, -6, 0]);
});

test("Twinkle keeps its existing quarter-note pulse and eight-beat count-in", () => {
  const chart = load("twinkle");
  const hits = beatHits(chart, -Infinity, 2400);
  expect(hits.filter(h => h.note === 37).map(h => h.atMs)).toEqual([-4800, -4200, -3600, -3000, -2400, -1800, -1200, -600]);
  expect(hits.filter(h => h.note === 42).map(h => h.atMs)).toEqual([0, 600, 1200, 1800]);
});

test.each(["twinkle", "nocturne-op9-2"].flatMap(song => [100, 70].map(percent => ({ song, percent }))))("$song audio startup at $percent percent keeps the grid through pause/resume", ({ song, percent }) => {
  const chart = load(song);
  chart.bpm *= percent / 100;
  const timing = beatTiming(chart);
  const beatMs = timing.pulseMs;
  let now = 10000;
  const epoch = now + timing.countInPulses * beatMs;
  const clock = pauseClock(epoch);
  const starts: number[] = [];
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("AudioContext", class {
    constructor() { now += 120; }
    get currentTime() { return now / 1000; }
    destination = {};
    resume = () => Promise.resolve();
    getOutputTimestamp = () => ({ contextTime: now / 1000, performanceTime: now });
    createGain = () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} });
    createOscillator = () => ({ frequency: { value: 0 }, connect: () => ({ connect() {} }), start: (at: number) => starts.push(at * 1000), stop() {} });
  });
  const plugin = beatTrack();
  plugin.transformChart!(chart, new URLSearchParams());
  plugin.onEvent!({ type: "songStart", atMs: clock.now(now) });
  // The first pulse is now late: skip it rather than moving the whole song's beat.
  now = 10000 + beatMs - 200;
  plugin.draw!(draw, { nowMs: clock.now(now), width: 800 } as Frame);
  expect(starts[0]).toBeCloseTo(10000 + beatMs, 6);

  now = epoch + beatMs / 2;
  clock.pause(now);
  plugin.onEvent!({ type: "pause", atMs: clock.now(now) });
  const count = starts.length;
  now += 4000;
  clock.resume(now);
  plugin.onEvent!({ type: "resume", atMs: clock.now(now) });
  now += beatMs / 2 - 200;
  plugin.draw!(draw, { nowMs: clock.now(now), width: 800 } as Frame);
  expect(starts).toHaveLength(count + 1);
  expect(starts.at(-1)).toBeCloseTo(clock.toPerf(beatMs), 6);
});

test.each(["twinkle", "nocturne-op9-2"].flatMap(song => [100, 70].map(percent => ({ song, percent }))))("$song MIDI at $percent percent follows the same pulse through pause/resume", async ({ song, percent }) => {
  const chart = load(song);
  chart.bpm *= percent / 100;
  const timing = beatTiming(chart);
  let now = 10000;
  const epoch = now + timing.countInPulses * timing.pulseMs;
  const clock = pauseClock(epoch);
  const sends: { bytes: number[]; at?: number }[] = [];
  const port = { name: "Portable Grand", send: (bytes: number[], at?: number) => sends.push({ bytes, at }), clear() {} };
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("navigator", { requestMIDIAccess: () => Promise.resolve({ outputs: new Map([["piano", port]]) }) });
  const audio = vi.fn();
  vi.stubGlobal("AudioContext", audio);
  const plugin = beatTrack();
  plugin.transformChart!(chart, new URLSearchParams());
  await Promise.resolve();
  plugin.onEvent!({ type: "songStart", atMs: clock.now(now) });
  const pauseAt = epoch + timing.pulseMs / 2;
  for (now = 10000; now < pauseAt; now += 16)
    plugin.draw!(draw, { nowMs: clock.now(now), width: 800 } as Frame);
  now = pauseAt;
  const clicks = sends.filter(s => s.bytes[0] === 0x99 && s.bytes[1] !== 36);
  expect(clicks.length).toBe(timing.countInPulses + 1);
  clicks.forEach((click, index) => expect(click.at).toBeCloseTo(10000 + index * timing.pulseMs, 6));
  clock.pause(now);
  plugin.onEvent!({ type: "pause", atMs: clock.now(now) });
  const beforeResume = sends.length;
  now += 4000;
  clock.resume(now);
  plugin.onEvent!({ type: "resume", atMs: clock.now(now) });
  now += timing.pulseMs / 2 - 200;
  plugin.draw!(draw, { nowMs: clock.now(now), width: 800 } as Frame);
  const resumed = sends.slice(beforeResume).filter(s => s.bytes[0] === 0x99);
  expect(resumed).toHaveLength(1);
  expect(resumed[0].at).toBeCloseTo(clock.toPerf(timing.pulseBeats * 60000 / chart.bpm), 6);
  expect(audio).not.toHaveBeenCalled();
});


test.each([
  ["twinkle", 1, 4, 8],
  ["minuet-g", 1, 3, 6],
  ["nocturne-op9-2", 1.5, 4, 8],
  ["fur-elise", 0.5, 3, 6],
  ["chopin-prelude-4", 2, 2, 4],
] as const)("%s uses its sourced pulse, complete bars and gap-free scheduling windows", (id, pulseBeats, pulsesPerBar, countInPulses) => {
  const chart = load(id);
  chart.bpm *= .7;
  expect(beatTiming(chart)).toMatchObject({ pulseBeats, pulsesPerBar, countInPulses });
  const timing = beatTiming(chart);
  const from = -timing.countInPulses * timing.pulseMs;
  const to = chart.beatsPerBar * 60000 / chart.bpm;
  const windows: ReturnType<typeof beatHits> = [];
  for (let at = from; at < to; at += 300)
    windows.push(...beatHits(chart, at, Math.min(to, at + 300)));
  expect(windows).toEqual(beatHits(chart, from, to));
});
