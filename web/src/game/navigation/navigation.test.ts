import { afterEach, expect, test, vi } from "vitest";
import type { InputEvent } from "../../contracts";
import { midiDevice } from "../core/input";
import { menuInput } from "./menu";
import { menuAllowed } from "./state";
import { LobbyPlayer, loopNotes } from "./music";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const press = (pitch: number, on = true): InputEvent => ({ type: on ? "on" : "off", pitch, velocity: on ? 80 : 0, timeMs: 0 });

test("piano menu needs a release, and a held performance key cannot confirm on results", () => {
  let allowed = true;
  const action = vi.fn(); const input = menuInput(() => allowed, action);
  input(press(52)); input(press(52));
  expect(action.mock.calls.map(c => c[0])).toEqual(["select"]);
  input(press(52, false)); allowed = false; input(press(52));
  allowed = true; input(press(52)); // still held across the phase transition
  expect(action).toHaveBeenCalledTimes(1);
  input(press(52, false)); input(press(52));
  expect(action).toHaveBeenCalledTimes(2);
  expect(menuAllowed("/play", "playing")).toBe(false);
  expect(menuAllowed("/play", "paused")).toBe(true);
  expect(menuAllowed("/learn/practice", "ready")).toBe(false);
  expect(menuAllowed("/sheet", "ready")).toBe(false);
});

test("one MIDI dispatcher preserves game input when the menu unsubscribes", async () => {
  const port = { name: "Portable Grand", onmidimessage: null as null | ((e: { data: Uint8Array; timeStamp: number }) => void) };
  vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ inputs: new Map([["port", port]]) }) });
  const menu = midiDevice(() => {}), game = midiDevice(() => {});
  const a = vi.fn(), b = vi.fn(); await menu.start(a); await game.start(b);
  port.onmidimessage!({ data: new Uint8Array([0x90, 60, 80]), timeStamp: 0 });
  expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
  menu.stop();
  port.onmidimessage!({ data: new Uint8Array([0x90, 60, 0]), timeStamp: 100 });
  expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(2);
  game.stop(); expect(port.onmidimessage).toBeNull();
});

function fakeAudio(resume: () => Promise<void> = async () => {}) {
  let now = 0;
  const voices: { stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }[] = [];
  const bus = { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return bus; }, disconnect: vi.fn() };
  const audio = { state: "running", get currentTime() { return now; }, destination: {}, resume,
    createGain: () => ({ ...bus, gain: { ...bus.gain } }),
    createOscillator: () => { const voice = { frequency: { value: 0 }, type: "triangle", connect: () => bus, start: vi.fn(), stop: vi.fn(), disconnect() {}, onended: null }; voices.push(voice); return voice; },
  };
  return { audio: audio as unknown as AudioContext, voices, bus, setTime: (t: number) => { now = t; } };
}

test("original lobby loop is deterministic and construction never starts audio", () => {
  const create = vi.fn(); new LobbyPlayer(create);
  expect(create).not.toHaveBeenCalled();
  expect(loopNotes(0)).toEqual(loopNotes(32));
  expect(loopNotes(0)).not.toEqual(loopNotes(8));
});

test("stopping during pending audio resume cannot start old lobby notes", async () => {
  let resume!: () => void;
  const fake = fakeAudio(() => new Promise<void>(resolve => { resume = resolve; }));
  const player = new LobbyPlayer(() => fake.audio);
  const pending = player.start(.12); player.stop(); resume();
  expect(await pending).toBe(false); expect(fake.voices).toHaveLength(0);
});

test("lobby stops scheduled notes and skips missed time instead of catch-up bursts", async () => {
  vi.useFakeTimers(); const fake = fakeAudio(); const player = new LobbyPlayer(() => fake.audio);
  expect(await player.start(.12)).toBe(true);
  const first = fake.voices.length; expect(first).toBeGreaterThan(0);
  fake.setTime(60); vi.advanceTimersByTime(25);
  expect(fake.voices.length - first).toBeLessThanOrEqual(3);
  player.stop(); const count = fake.voices.length;
  vi.advanceTimersByTime(5000); expect(fake.voices).toHaveLength(count);
  expect(fake.voices.every(v => v.stop.mock.calls.length >= 2)).toBe(true);
});
