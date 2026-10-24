import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, InputDevice, InputEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { handMode } from ".";
import { ALL_NOTES_OFF_CH1, echoGuard, handsSetting, playbackBetween, splitHands } from "./hands";

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
});
