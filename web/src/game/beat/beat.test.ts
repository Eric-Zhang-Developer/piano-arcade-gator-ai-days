import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import type { Chart, Frame } from "../../contracts";
import { settings } from "../core/settings";
import { beatHits, beatOn, beatTrack, endBeat } from "./index";

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

test("?mode=wait plays no beat: the clock stops at every note", () => {
  const AudioContext = vi.fn();
  vi.stubGlobal("AudioContext", AudioContext);
  const plugin = beatTrack();
  plugin.transformChart!(chart, new URLSearchParams("mode=wait"));
  plugin.onEvent!({ type: "songStart", atMs: -count * mpb });
  expect(AudioContext).not.toHaveBeenCalled();
});

test("?capture=1: draw writes no Beat: text, and the beat still plays", () => {
  const texts: string[] = [];
  const ctx = { fillText: (t: string) => void texts.push(t) } as unknown as CanvasRenderingContext2D;
  const plugin = beatTrack();
  plugin.transformChart!(chart, new URLSearchParams("beat=off"));
  plugin.draw!(ctx, { nowMs: 0, width: 800 } as Frame);
  expect(texts).toEqual(["Beat: off"]); // without capture: today's status text
  vi.stubGlobal("document", { documentElement: { hasAttribute: (a: string) => a === "data-capture" } });
  texts.length = 0;
  plugin.draw!(ctx, { nowMs: 0, width: 800 } as Frame);
  expect(texts).toEqual([]);
});

// ?beat=<style>: one bar after the count-in, on synthetic charts of the pattern's meter, at 60 bpm (1 beat = 1000 ms).
const meter = (beatsPerBar: number): Chart => ({
  id: "m",
  title: "m",
  composer: "c",
  source: "synthetic",
  bpm: 60,
  beatsPerBar,
  notes: [{ id: "n", pitch: 60, beat: 0, duration: beatsPerBar * 2, hand: "R" }],
});
const bar = (c: Chart, style: string, from = 0) =>
  beatHits(c, from * 1000, (from + c.beatsPerBar) * 1000, count, style).map((h) => [h.atMs / 1000, h.note, h.velocity]);

test("?beat=ragtime: kick on 1, snare on 2, hi-hat eighths, each 2-beat cycle of a 4/4 bar", () => {
  const c = meter(4);
  expect(bar(c, "ragtime")).toEqual([
    [0, 36, 48], [0, 42, 45], [0.5, 42, 45], [1, 38, 42], [1, 42, 45], [1.5, 42, 45],
    [2, 36, 48], [2, 42, 45], [2.5, 42, 45], [3, 38, 42], [3, 42, 45], [3.5, 42, 45],
  ]);
});

test("?beat=waltz: kick on 1, hi-hat on 2 and 3", () => {
  expect(bar(meter(3), "waltz")).toEqual([[0, 36, 48], [1, 42, 50], [2, 42, 50]]);
});

test("?beat=trap: kick on 1, clap on 3, hi-hat sixteenths louder on the beat", () => {
  const hits = bar(meter(4), "trap");
  expect(hits.filter(([, n]) => n !== 42)).toEqual([[0, 36, 51], [2, 39, 45]]);
  expect(hits.filter(([, n]) => n === 42).map(([t, , v]) => [t, v])).toEqual(
    Array.from({ length: 16 }, (_, i) => [i / 4, i % 4 ? 35 : 50]),
  );
});

test("?beat=lullaby: one soft side stick on each bar's 1, any meter", () => {
  expect(bar(meter(3), "lullaby")).toEqual([[0, 37, 40]]);
  expect(bar(meter(4), "lullaby", 4)).toEqual([[4, 37, 40]]);
});

test("a style that doesn't fit the meter, or an unknown one, plays the default; the count-in never changes", () => {
  const c = meter(3);
  expect(bar(c, "trap")).toEqual(bar(c, "nope"));
  expect(beatHits(c, -Infinity, 0, count, "trap")).toEqual(beatHits(c, -Infinity, 0));
  expect(beatHits(chart, -Infinity, Infinity, count, null)).toEqual(all);
});

test("consecutive windows return every styled hit exactly once", () => {
  const c = meter(4);
  const whole = beatHits(c, -Infinity, Infinity, count, "trap");
  const windows: ReturnType<typeof beatHits> = [];
  for (let t = -count * 1000 - 7; t < 12000; t += 300) windows.push(...beatHits(c, t, t + 300, count, "trap"));
  expect(windows).toEqual(whole);
});

test("a song with its own recording has no beat by default; ?beat=<style> still forces one (#789)", () => {
  const q = (s: string) => new URLSearchParams(s);
  expect(beatOn(q("song=twinkle"), false)).toBe(true);
  expect(beatOn(q("song=local/golden-hard"), true)).toBe(false);
  expect(beatOn(q("song=local/golden-hard&beat=rock"), true)).toBe(true);
  expect(beatOn(q("song=local/golden-hard&beat=off"), true)).toBe(false);
  expect(beatOn(q("beat=off"), false)).toBe(false);
  expect(beatOn(q("mode=wait"), false)).toBe(false);
  expect(beatOn(q("mode=flow&beat=rock"), false)).toBe(false);
});
