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
