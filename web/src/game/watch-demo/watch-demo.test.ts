import { describe, expect, it } from "vitest";
import type { Chart, InputDevice } from "../../contracts";
import { isWatchKey, returnAt, watchDemo, watchSettings, watchUrl } from ".";

const key = (k: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "repeat", boolean>> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...mods,
});

describe("watch-demo", () => {
  it("W opens the exact demo URL", () => {
    expect(watchUrl("fur-elise")).toBe("/play?song=fur-elise&bot=perfect&audible=1&demo=1");
  });

  it("isWatchKey: plain w or W only", () => {
    expect([isWatchKey(key("w")), isWatchKey(key("W"))]).toEqual([true, true]);
    expect([isWatchKey(key("w", { metaKey: true })), isWatchKey(key("w", { ctrlKey: true })), isWatchKey(key("w", { altKey: true }))]).toEqual([false, false, false]);
    expect([isWatchKey(key("w", { repeat: true })), isWatchKey(key("q"))]).toEqual([false, false]);
  });

  it("the return is armed at songEnd and cancelled by songStart and quit", () => {
    const armed = returnAt(null, { type: "songEnd" }, 1000);
    expect(armed).toBe(1000 + watchSettings.returnMs);
    expect(returnAt(armed, { type: "noteHit" }, 2000)).toBe(armed);
    expect(returnAt(armed, { type: "songStart" }, 2000)).toBeNull();
    expect(returnAt(armed, { type: "quit" }, 2000)).toBeNull();
  });

  it("without demo=1 the plugin does nothing", () => {
    const p = watchDemo();
    const chart = { bpm: 120, notes: [{ id: "n1", pitch: 60, beat: 0, duration: 1 }] } as unknown as Chart;
    expect(p.transformChart!(chart, new URLSearchParams("song=twinkle&bot=perfect"))).toBe(chart);
    const midi = { kind: "midi" } as InputDevice;
    expect(p.wrapInput!(midi)).toBe(midi);
    expect(p.startPanel!({ chart, params: new URLSearchParams() })).toBeNull();
    expect(p.resultsPanel!({} as never)).toBeNull();
    p.onEvent!({ type: "songEnd" } as never); // no timer, no hook
    expect(globalThis.window?.__pianoArcadeDemo).toBeUndefined();
  });

  it("with demo=1 the MIDI input never emits; the laptop keys pass through untouched", () => {
    const p = watchDemo();
    p.transformChart!({ bpm: 120, notes: [] } as unknown as Chart, new URLSearchParams("demo=1"));
    let started = false;
    const midi: InputDevice = { kind: "midi", start: () => void (started = true), stop() {} };
    const wrapped = p.wrapInput!(midi);
    void wrapped.start(() => {});
    expect([wrapped.kind, started]).toEqual(["midi", false]);
    const keys = { kind: "keys" } as InputDevice;
    expect(p.wrapInput!(keys)).toBe(keys);
  });
});
