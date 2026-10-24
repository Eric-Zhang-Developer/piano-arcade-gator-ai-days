import type { InputDevice, InputEvent } from "../../contracts";
import { KEYS_VELOCITY } from "./settings";

const isBlack = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);

// Chrome Web MIDI. Prefers the DGX-660 ("Portable Grand"), else the first input.
export function midiDevice(onStatus: (status: string) => void): InputDevice {
  let input: MIDIInput | null = null;
  let generation = 0;
  return {
    kind: "midi",
    async start(onEvent) {
      const run = ++generation;
      if (!navigator.requestMIDIAccess) return onStatus("MIDI: not supported (use Chrome)");
      try {
        const access = await navigator.requestMIDIAccess();
        if (run !== generation) return;
        const inputs = [...access.inputs.values()];
        input = inputs.find((i) => i.name?.includes("Portable Grand")) ?? inputs[0] ?? null;
        if (!input) return onStatus("MIDI: no device, laptop keys only");
        onStatus(`MIDI: ${input.name}`);
        input.onmidimessage = (m) => {
          const d = m.data;
          if (!d || d[0] === 0xfe || d[0] === 0xf8) return;
          const cmd = d[0] & 0xf0;
          if (cmd !== 0x90 && cmd !== 0x80) return; // pedal and other CCs aren't judged
          const on = cmd === 0x90 && d[2] > 0; // note-on with velocity 0 is a release
          onEvent({ type: on ? "on" : "off", pitch: d[1], velocity: on ? d[2] : 0, timeMs: m.timeStamp });
        };
      } catch (e) {
        if (run !== generation) return;
        onStatus(`MIDI: ${(e as Error).name}, laptop keys only`);
      }
    },
    stop() {
      generation++;
      if (input) input.onmidimessage = null;
      input = null;
    },
  };
}

const WHITE_CODES = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon"];
// The row above sits between white keys: W is the gap after A, E after S, and so on.
const GAP_CODES = ["KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP"];

// Laptop keys, starting at the chart's lowest white key (the white below it if it's black).
export function keyMap(lowestPitch: number): Map<string, number> {
  const map = new Map<string, number>();
  let white = isBlack(lowestPitch) ? lowestPitch - 1 : lowestPitch;
  WHITE_CODES.forEach((code, i) => {
    map.set(code, white);
    const next = white + (isBlack(white + 1) ? 2 : 1);
    if (next - white === 2 && i < GAP_CODES.length) map.set(GAP_CODES[i], white + 1);
    white = next;
  });
  return map;
}

export function keysDevice(lowestPitch: number): InputDevice {
  const map = keyMap(lowestPitch);
  let down: ((e: KeyboardEvent) => void) | null = null;
  let up: ((e: KeyboardEvent) => void) | null = null;
  return {
    kind: "keys",
    start(onEvent) {
      const handle = (type: "on" | "off") => (e: KeyboardEvent) => {
        const pitch = map.get(e.code);
        if (pitch === undefined || e.repeat || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        onEvent({ type, pitch, velocity: type === "on" ? KEYS_VELOCITY : 0, timeMs: e.timeStamp });
      };
      down = handle("on");
      up = handle("off");
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
    },
    stop() {
      if (down) window.removeEventListener("keydown", down);
      if (up) window.removeEventListener("keyup", up);
    },
  };
}

// Driven by the verify script (?input=test only): key-ons at exact performance.now() times.
export function testDevice(): InputDevice & { queue(pitch: number, perfMs: number, velocity: number): void } {
  const pending: InputEvent[] = [];
  let raf = 0;
  return {
    kind: "test",
    queue(pitch, perfMs, velocity) {
      pending.push({ type: "on", pitch, velocity, timeMs: perfMs }, { type: "off", pitch, velocity: 0, timeMs: perfMs + 100 });
      pending.sort((a, b) => a.timeMs - b.timeMs);
    },
    start(onEvent) {
      const tick = () => {
        while (pending.length && pending[0].timeMs <= performance.now()) onEvent(pending.shift()!);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
  };
}
