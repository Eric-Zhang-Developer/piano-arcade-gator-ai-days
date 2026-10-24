import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UiSound } from ".";

// A fake AudioContext: records oscillator starts and stops, every gain level a node is set to, and the master gain.
function fakeAudio() {
  const log = { starts: 0, stops: 0, peaks: [] as number[], masters: [] as { value: number }[] };
  class FakeContext {
    currentTime = 0;
    destination = {};
    createOscillator() {
      return { type: "", frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n, start: () => log.starts++, stop: () => log.stops++ };
    }
    createGain() {
      const gain = { value: 1, setValueAtTime: (v: number) => void log.peaks.push(v), exponentialRampToValueAtTime() {} };
      if (!log.masters.length) log.masters.push(gain); // the module's own gain is the first it makes
      return { gain, connect: (n: unknown) => n };
    }
  }
  return { log, FakeContext };
}

let audio: ReturnType<typeof fakeAudio>;
const activation = { hasBeenActive: true };

beforeEach(() => {
  vi.resetModules(); // the module keeps one context for the page's life: a fresh module per test
  audio = fakeAudio();
  vi.stubGlobal("window", {});
  vi.stubGlobal("AudioContext", audio.FakeContext);
  vi.stubGlobal("navigator", { userActivation: activation });
  activation.hasBeenActive = true;
});
afterEach(() => vi.unstubAllGlobals());

const load = async () => ({ ...(await import(".")), sound: await import("../sound") });

describe("ui sounds", () => {
  it("each sound starts nodes and stops every one, and no level is above the preview tone's peak", async () => {
    const { uiSound, UI_PEAK } = await load();
    expect(UI_PEAK).toBeCloseTo(0.0504, 3);
    for (const name of ["move", "confirm", "back", "sting", "tick", "tickAccent"] as UiSound[]) {
      const before = audio.log.starts;
      uiSound(name);
      expect(audio.log.starts, name).toBeGreaterThan(before);
    }
    expect(audio.log.stops).toBe(audio.log.starts);
    expect(Math.max(...audio.log.peaks)).toBeLessThanOrEqual(UI_PEAK);
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

  it("drops a sound asked for before the page's first user activation", async () => {
    const { uiSound } = await load();
    activation.hasBeenActive = false;
    uiSound("sting");
    expect(audio.log.starts).toBe(0);
    activation.hasBeenActive = true;
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
