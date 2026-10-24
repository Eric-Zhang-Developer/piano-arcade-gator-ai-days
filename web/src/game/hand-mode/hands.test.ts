import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, InputDevice, InputEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { handMode } from ".";
import { ALL_NOTES_OFF_CH1, echoGuard, handsSetting, playbackBetween, splitHands, waitSends, type WaitSend } from "./hands";

const load = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const furElise = load("fur-elise");
const twinkle = load("twinkle");

describe("hand mode", () => {
  it("?hands=R keeps exactly the R notes; playback holds exactly the L notes at their times and velocities", () => {
    const { judged, playback } = splitHands(furElise, handsSetting("R"));
    expect(judged.notes).toEqual(furElise.notes.filter((n) => n.hand === "R"));
    expect(playback).toEqual(furElise.notes.filter((n) => n.hand === "L"));
    const mpb = msPerBeat(furElise.bpm);
    const all = playbackBetween(furElise, playback, -Infinity, Infinity);
    expect(all).toEqual(playback.map((n) => ({ pitch: n.pitch, velocity: n.velocity ?? 80, atMs: n.beat * mpb, endMs: (n.beat + n.duration) * mpb })));
  });

  it("leaves a one-hand chart, and hands=both, unchanged", () => {
    expect(splitHands(twinkle, "L")).toEqual({ judged: twinkle, playback: [] });
    expect(splitHands(furElise, handsSetting(null))).toEqual({ judged: furElise, playback: [] });
    expect(handsSetting("x")).toBe("both");
  });

  it("plays a note without a velocity at 80", () => {
    const n = { id: "a", pitch: 48, beat: 2, duration: 1, hand: "L" as const };
    expect(playbackBetween(twinkle, [n], 0, 1e9)[0].velocity).toBe(80);
  });

  it("the echo guard drops a same-pitch note-on at +20 ms but not at +40 ms", () => {
    const g = echoGuard();
    g.sent(45, 1000);
    expect(g.isEcho(45, 1020)).toBe(true);
    expect(g.isEcho(45, 1040)).toBe(false);
    expect(g.isEcho(46, 1010)).toBe(false);

    // Through the plugin: a MIDI device's echo never reaches the game.
    const plugin = handMode();
    let fire: (e: InputEvent) => void = () => {};
    const got: InputEvent[] = [];
    const midi: InputDevice = { kind: "midi", start: (on) => void (fire = on), stop: () => {} };
    void plugin.wrapInput!(midi).start((e) => got.push(e));
    fire({ type: "on", pitch: 45, velocity: 70, timeMs: 5 });
    expect(got).toHaveLength(1); // nothing sent yet, so nothing is an echo
  });
});

describe("hand mode in wait mode (wait-hands)", () => {
  // bpm 60: a beat is 1000 ms. The right hand (yours) holds the clock at 1000 ms.
  const chart: Chart = { id: "w", title: "W", composer: "C", source: "test", bpm: 60, beatsPerBar: 4, notes: [] };
  const L = (id: string, pitch: number, beat: number, duration: number) => ({ id, pitch, beat, duration, hand: "L" as const });
  const notes = [L("with", 45, 1, 0.5), L("after", 52, 1.2, 0.3), L("ends", 57, 0.5, 1), L("again", 57, 1.5, 0.5)];
  const label = (e: WaitSend) => `${e.type} ${e.p.pitch}@${e.p.atMs}`;

  // Frames: 16 ms steps to the hold at 1000, 3 s of frames held there, then 16 ms steps to 2100.
  const frames: number[] = [];
  for (let t = 0; t < 1000; t += 16) frames.push(t);
  for (let i = 0; i < 180; i++) frames.push(1000);
  for (let t = 1016; t <= 2100; t += 16) frames.push(t);
  const run = () => {
    const out: { now: number; e: WaitSend }[] = [];
    let last = frames[0];
    for (const now of frames.slice(1)) {
      for (const e of waitSends(chart, notes, last, now)) out.push({ now, e });
      last = Math.max(last, now);
    }
    return out;
  };

  it("sends nothing ahead during a hold; the note at the held time goes on the first frame past it", () => {
    const out = run();
    const held = out.filter((s) => s.now === 1000);
    expect(held.map((s) => label(s.e))).toEqual([]); // 3 s at 1000: neither 1000 nor 1200 goes out
    const at = (type: string, pitch: number, atMs: number) => out.find((s) => s.e.type === type && s.e.p.pitch === pitch && s.e.p.atMs === atMs)?.now;
    expect(at("on", 45, 1000)).toBe(1016);
    expect(at("on", 52, 1200)).toBe(1208); // the first frame past 1200
    expect(at("off", 45, 1000)).toBe(1512); // ends at 1500: the first frame past it
  });

  it("each note-off goes on the first frame past its end, and a pitch ending as it restarts goes off, then on", () => {
    const out = run();
    const ends = out.filter((s) => s.e.p.pitch === 57).map((s) => `${s.e.type}@${s.e.p.atMs} frame ${s.now}`);
    expect(ends).toEqual(["on@500 frame 512", "off@500 frame 1512", "on@1500 frame 1512", "off@1500 frame 2008"]);
    const off52 = out.find((s) => s.e.type === "off" && s.e.p.pitch === 52)!;
    expect(off52.now).toBe(1512); // 1200 + 300 = 1500
  });

  it("a note that starts and ends inside one frame goes on, then off", () => {
    const short = [L("blip", 60, 0.1, 0.005)];
    expect(waitSends(chart, short, 90, 120).map((e) => e.type)).toEqual(["on", "off"]);
  });
});

describe("hand mode on a piano", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the other hand on channel 1, and All Notes Off when the song ends", async () => {
    const sent: { data: number[]; at?: number }[] = [];
    const output = { name: "Portable Grand", send: (data: number[], at?: number) => sent.push({ data, at }), clear: () => {} };
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map([["o", output]]) }) });
    vi.stubGlobal("AudioContext", undefined);
    const plugin = handMode();
    plugin.transformChart!(furElise, new URLSearchParams("hands=R"));
    plugin.onEvent!({ type: "songStart", atMs: -100 });
    await Promise.resolve();
    await Promise.resolve();
    const first = furElise.notes.filter((n) => n.hand === "L").sort((a, b) => a.beat - b.beat)[0];
    const at = first.beat * msPerBeat(furElise.bpm);
    plugin.draw!({} as CanvasRenderingContext2D, { nowMs: at - 1 } as never);
    const on = sent.find((s) => s.data[0] === 0x90);
    expect(on?.data).toEqual([0x90, first.pitch, first.velocity ?? 80]);
    sent.length = 0;
    plugin.onEvent!({ type: "songEnd", atMs: 1e6, results: {} as never });
    expect(sent.map((s) => s.data)).toEqual([ALL_NOTES_OFF_CH1]);
  });

  it("in wait mode sends on the frame, with no timestamp, and the echo guard stamped at the send", async () => {
    const sent: { data: number[]; at?: number }[] = [];
    const output = { name: "Portable Grand", send: (data: number[], at?: number) => sent.push({ data, at }), clear: () => {} };
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map([["o", output]]) }) });
    vi.stubGlobal("AudioContext", undefined);
    let perf = 0;
    vi.spyOn(performance, "now").mockImplementation(() => perf);
    const plugin = handMode();
    plugin.transformChart!(furElise, new URLSearchParams("hands=R&mode=wait"));
    plugin.onEvent!({ type: "songStart", atMs: -100 });
    await Promise.resolve();
    await Promise.resolve();
    const first = furElise.notes.filter((n) => n.hand === "L").sort((a, b) => a.beat - b.beat)[0];
    const at = first.beat * msPerBeat(furElise.bpm);
    const draw = (nowMs: number) => plugin.draw!({} as CanvasRenderingContext2D, { nowMs } as never);
    draw(at - 1);
    draw(at); // held at the note's time: not past it
    expect(sent).toEqual([]);
    perf = 60_000; // a long hold, in wall time
    draw(at + 16);
    expect(sent).toEqual([{ data: [0x90, first.pitch, first.velocity ?? 80], at: undefined }]);

    let fire: (e: InputEvent) => void = () => {};
    const got: InputEvent[] = [];
    void plugin.wrapInput!({ kind: "midi", start: (on) => void (fire = on), stop: () => {} }).start((e) => got.push(e));
    fire({ type: "on", pitch: first.pitch, velocity: 70, timeMs: 60_010 }); // the piano's echo, 10 ms after the send
    expect(got).toEqual([]);
    vi.restoreAllMocks();
  });
});
