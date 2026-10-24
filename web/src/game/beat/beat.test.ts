import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import type { Chart, Frame } from "../../contracts";
import { settings } from "../core/settings";
import { beatHits, beatTrack, endBeat } from "./index";

const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const mpb = 60000 / chart.bpm;
const count = settings.countInBeats;
const all = beatHits(chart, -Infinity, Infinity);
const at = (note: number) => all.filter((h) => h.note === note).map((h) => h.atMs / mpb);
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

test("Twinkle: side stick on each count-in beat, hi-hat on beats 0–51, kick on each bar's beat 1, nothing from 52", () => {
  expect(endBeat(chart)).toBe(52);
  expect(at(37)).toEqual(range(-count, 0));
  expect(at(42)).toEqual(range(0, 52));
  expect(at(36)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]);
  expect(all.every((h) => h.atMs < 52 * mpb)).toBe(true);
});

test("accent falls on beat 1 of each bar, count-in included", () => {
  expect(all.filter((h) => h.note === 37 && h.accent).map((h) => h.atMs / mpb)).toEqual(range(-count, 0).filter((b) => (b + count) % 4 === 0));
  expect(all.filter((h) => h.note === 42 && h.accent).map((h) => h.atMs / mpb)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48]);
});

test("consecutive windows return every hit exactly once", () => {
  const windows: ReturnType<typeof beatHits> = [];
  for (let t = -count * mpb - 7; t < 60 * mpb; t += 300) windows.push(...beatHits(chart, t, t + 300));
  expect(windows).toEqual(all);
});

test("a window returns only the hits inside it", () => {
  expect(beatHits(chart, 0, mpb).map((h) => h.note)).toEqual([36, 42]);
  expect(beatHits(chart, 1, mpb)).toEqual([]);
});

// Chrome before the audio starts: currentTime is 0 and there's no output timestamp yet. AudioParam and start/stop
// reject a negative time with a RangeError, as Chrome does. Its first click comes at songStart itself.
class NotYetRunningAudio {
  currentTime = 0;
  destination = {};
  times: number[] = [];
  private at = (t: number) => {
    if (!Number.isFinite(t) || t < 0) throw new RangeError(`Time must be a finite non-negative number: ${t}`);
    this.times.push(t);
  };
  getOutputTimestamp = () => ({ contextTime: 0, performanceTime: 0 });
  resume = () => Promise.resolve();
  createGain = () => ({ gain: { setValueAtTime: (_: number, t: number) => this.at(t), exponentialRampToValueAtTime: (_: number, t: number) => this.at(t) }, connect: (d: unknown) => d });
  createOscillator = () => ({ frequency: { value: 0 }, connect: (g: unknown) => g, start: (t: number) => this.at(t), stop: (t: number) => this.at(t) });
}

afterEach(() => vi.unstubAllGlobals());

test("laptop clicks: songStart before the audio runs schedules at non-negative times instead of throwing", () => {
  const audio = new NotYetRunningAudio();
  vi.stubGlobal("AudioContext", function () {
    return audio;
  });
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => (now += 2)); // time passes between readings, as it does live
  const plugin = beatTrack();
  plugin.transformChart!(chart, new URLSearchParams());
  expect(() => plugin.onEvent!({ type: "songStart", atMs: -count * mpb })).not.toThrow();
  expect(audio.times.length).toBeGreaterThan(0);
  expect(Math.min(...audio.times)).toBeGreaterThanOrEqual(0);
  vi.restoreAllMocks();
});

test("pause silences the laptop clicks, queued ones included; resume brings them back on the beat", () => {
  const buses: { connected: boolean }[] = [];
  const starts: number[] = [];
  const audio = {
    currentTime: 0,
    destination: {},
    getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 1000 }),
    resume: () => Promise.resolve(),
    createGain() {
      const node = { connected: false, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => ((node.connected = true), d), disconnect: () => void (node.connected = false) };
      buses.push(node);
      return node;
    },
    createOscillator: () => ({ frequency: { value: 0 }, connect: (g: unknown) => g, start: (t: number) => starts.push(t), stop() {} }),
  };
  vi.stubGlobal("AudioContext", function () {
    return audio;
  });
  vi.spyOn(performance, "now").mockReturnValue(1000);
  const plugin = beatTrack();
  plugin.transformChart!(chart, new URLSearchParams());
  plugin.onEvent!({ type: "songStart", atMs: 0 }); // beat 0 queued (lookahead 300 ms)
  const bus = buses[0];
  expect(bus.connected).toBe(true);
  expect(starts).toHaveLength(1);

  plugin.onEvent!({ type: "pause", atMs: 100 });
  expect(bus.connected).toBe(false); // what was queued can't be heard
  plugin.draw!({ fillText() {} } as unknown as CanvasRenderingContext2D, { nowMs: 100, width: 800 } as Frame);
  expect(starts).toHaveLength(1); // nothing new while paused

  plugin.onEvent!({ type: "resume", atMs: 500 }); // chart time stood still; beat 1 is at 600 ms
  expect(buses.at(-1)!.connected).toBe(true);
  expect(starts).toHaveLength(2);
  expect(starts[1]).toBeCloseTo((600 - 500) / 1000); // 100 ms after the resume, on the beat
  vi.restoreAllMocks();
});
