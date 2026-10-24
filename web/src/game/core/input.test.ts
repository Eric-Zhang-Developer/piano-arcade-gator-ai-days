import { afterEach, expect, test, vi } from "vitest";
import { keyMap, midiDevice } from "./input";

afterEach(() => vi.unstubAllGlobals());

test("leaving while MIDI permission is pending cannot attach an old input handler", async () => {
  let allow!: (access: { inputs: Map<string, object> }) => void;
  const permission = new Promise<{ inputs: Map<string, object> }>(resolve => { allow = resolve; });
  const input = { name: "Portable Grand", onmidimessage: null };
  vi.stubGlobal("navigator", { requestMIDIAccess: () => permission });
  const status = vi.fn();
  const event = vi.fn();
  const device = midiDevice(status);
  const pending = device.start(event);
  device.stop();
  allow({ inputs: new Map([["piano", input]]) });
  await pending;
  expect(input.onmidimessage).toBeNull();
  expect(status).not.toHaveBeenCalled();
  expect(event).not.toHaveBeenCalled();
});

test("laptop keys from C4: whites on A–;, blacks on W E T Y U O P", () => {
  const m = keyMap(60);
  expect(["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"].map((c) => m.get(c))).toEqual([
    60, 62, 64, 65, 67, 69, 71, 72, 74, 76,
  ]);
  expect(["KeyW", "KeyE", "KeyT", "KeyY", "KeyU", "KeyO", "KeyP"].map((c) => m.get(c))).toEqual([61, 63, 66, 68, 70, 73, 75]);
  expect(m.has("KeyR")).toBe(false);
  expect(m.has("KeyI")).toBe(false);
});

test("a black lowest note starts at the white key below it", () => {
  expect(keyMap(61).get("KeyA")).toBe(60);
});

test("velocity-zero is a release; unplug cancels without inventing physical release evidence", async () => {
  let state: () => void = () => {};
  const input = { name: "Portable Grand", state: "connected", onmidimessage: null as null | ((e: { data: Uint8Array; timeStamp: number }) => void) };
  vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ inputs: new Map([["piano", input]]), addEventListener: (_: string, cb: () => void) => { state = cb; }, removeEventListener() {} }) });
  const events: { type: string; cancelled?: true }[] = [];
  const device = midiDevice(() => {});
  await device.start(e => events.push(e));
  input.onmidimessage!({ data: new Uint8Array([0x90, 60, 80]), timeStamp: 0 });
  input.onmidimessage!({ data: new Uint8Array([0x90, 60, 0]), timeStamp: 50 });
  input.onmidimessage!({ data: new Uint8Array([0x90, 64, 80]), timeStamp: 100 });
  input.state = "disconnected"; state(); state();
  expect(events.map(e => [e.type, !!e.cancelled])).toEqual([["on", false], ["off", false], ["on", false], ["off", true]]);
  device.stop();
});
