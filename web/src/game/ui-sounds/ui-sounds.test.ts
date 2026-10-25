import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UiSound } from ".";

// A fake AudioContext: records buffer-source starts and stops, each started buffer's peak, and the master gain.
function fakeAudio() {
  const log = { starts: 0, stops: 0, peaks: [] as number[], masters: [] as { value: number }[] };
  class FakeContext {
    currentTime = 0;
    sampleRate = 48000;
    destination = {};
    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return { data, copyToChannel: (d: Float32Array) => data.set(d) };
    }
    createBufferSource() {
      const src = {
        buffer: null as { data: Float32Array } | null,
        connect: (n: unknown) => n,
        start: () => {
          log.starts++;
          log.peaks.push(src.buffer!.data.reduce((m, x) => Math.max(m, Math.abs(x)), 0));
        },
        stop: () => log.stops++,
      };
      return src;
    }
    createGain() {
      const gain = { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} };
      if (!log.masters.length) log.masters.push(gain); // the module's own gain is the first it makes
      return { gain, connect: (n: unknown) => n };
    }
  }
  return { log, FakeContext };
}

let audio: ReturnType<typeof fakeAudio>;
// A window that keeps its listeners, so a test can send the page a key or pointer press.
let listeners: Record<string, ((e: { isTrusted: boolean }) => void)[]>;
const press = (type: string, isTrusted = true) => listeners[type]?.forEach((f) => f({ isTrusted }));

beforeEach(() => {
  vi.resetModules(); // the module keeps one context for the page's life: a fresh module per test
  audio = fakeAudio();
  listeners = {};
  vi.stubGlobal("window", { addEventListener: (t: string, f: (e: { isTrusted: boolean }) => void) => (listeners[t] ??= []).push(f) });
  vi.stubGlobal("AudioContext", audio.FakeContext);
  vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
});
afterEach(() => vi.unstubAllGlobals());

// The module, after the page's first key press unless `pressed` is false.
const load = async (pressed = true) => {
  const m = { ...(await import(".")), sound: await import("../sound") };
  if (pressed) press("keydown");
  return m;
};

describe("ui sounds", () => {
  it("each sound starts one rendered buffer, peaking at UI_LEVEL, 12 dB or more under the preview tone's peak", async () => {
    const { uiSound, UI_PEAK, UI_LEVEL } = await load();
    expect(UI_PEAK).toBeCloseTo(0.0504, 3);
    expect(UI_LEVEL).toBeLessThanOrEqual(UI_PEAK * 10 ** (-12 / 20));
    for (const [i, name] of (["move", "confirm", "back", "sting", "tick", "tickAccent"] as UiSound[]).entries()) {
      const before = audio.log.starts;
      uiSound(name, i * 1000); // a second apart: no pile-up
      expect(audio.log.starts, name).toBe(before + 1);
    }
    for (const p of audio.log.peaks) expect(p).toBeCloseTo(UI_LEVEL, 6);
  });

  it("a burst steals the oldest voice with a fade, never stacking past the cap", async () => {
    const { uiSound } = await load();
    for (let i = 0; i < 10; i++) uiSound("move"); // all at once: each inside the 60 ms gap
    expect(audio.log.starts).toBe(10);
    expect(audio.log.stops).toBe(9); // every earlier one faded out
  });

  it("follows the effects volume, and mute takes the gain to 0 at once and starts nothing more", async () => {
    const { uiSound, sound } = await load();
    uiSound("move");
    const master = audio.log.masters[0];
    expect(master.value).toBe(sound.DEFAULT_PREFS.volume);
    sound.savePrefs({ ...sound.getPrefs(), muted: true });
    expect(master.value).toBe(0);
    const before = audio.log.starts;
    uiSound("confirm");
    expect(audio.log.starts).toBe(before);
    sound.savePrefs({ ...sound.getPrefs(), muted: false, volume: 0.3 });
    expect(master.value).toBe(0.3);
  });

  it("drops a sound before the page's own first press, even when the browser reports activation (#465)", async () => {
    const { uiSound } = await load(false); // navigator.userActivation.hasBeenActive is true, as on CI's direct load
    uiSound("sting");
    expect(audio.log.starts).toBe(0);
    press("keydown", false); // a synthetic event doesn't count
    uiSound("sting");
    expect(audio.log.starts).toBe(0);
    press("pointerdown");
    uiSound("sting");
    expect(audio.log.starts).toBeGreaterThan(0);
  });

  it("makes its context in idle time after load, before any sound, and starts nothing", async () => {
    vi.stubGlobal("window", { requestIdleCallback: (f: () => void) => f() });
    await load();
    expect(audio.log.masters).toHaveLength(1);
    expect(audio.log.starts).toBe(0);
  });
});
