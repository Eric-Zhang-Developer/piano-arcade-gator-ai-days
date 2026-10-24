import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart, Frame, InputDevice, InputEvent } from "../../contracts";
import { canMove, follow, laptopMap, laptopOctaves, octaveSettings, onScreen, type View } from ".";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));

// A canvas that counts what was filled.
function canvas() {
  const filled: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) =>
      k === "fillRect" || k === "fillText"
        ? (...a: unknown[]) => filled.push(`${String(k)} ${a[0]}`)
        : k === "createLinearGradient"
          ? () => ({ addColorStop() {} })
          : k in t
            ? t[k as string]
            : () => {},
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, filled };
}

const frame = (v: View): Frame => ({
  nowMs: 0, lowPitch: v.lo, highPitch: v.hi, judgmentLineY: 500, width: 1280, height: 600,
  keyX: (p) => ({ x: (p - v.lo) * 20, width: 20 }),
});

// The plugin over one chart, with fake keys and MIDI devices: press(code) and release(code) for laptop keys.
function setup(chart: Chart) {
  const plugin = laptopOctaves();
  plugin.transformChart!(chart, new URLSearchParams());
  const got: InputEvent[] = [];
  const fire: Record<string, (e: InputEvent) => void> = {};
  const fake = (kind: InputDevice["kind"]): InputDevice => ({ kind, start: (on) => void (fire[kind] = on), stop: () => {} });
  const keys = plugin.wrapInput!(fake("keys"));
  void keys.start((e) => got.push(e));
  void plugin.wrapInput!(fake("midi")).start((e) => got.push(e));
  const key = (code: string, extra: Partial<KeyboardEvent> = {}) =>
    window.dispatchEvent(Object.assign(new Event("keydown"), { code, repeat: false, metaKey: false, ctrlKey: false, ...extra }));
  // A is the map's lowest key; the fake device reports it as that pitch at k = 0, as keysDevice does.
  const lowest = Math.min(...chart.notes.map((n) => n.pitch));
  const a = (type: "on" | "off") => {
    fire.keys({ type, pitch: lowest, velocity: type === "on" ? 80 : 0, timeMs: 0 });
    return got[got.length - 1].pitch;
  };
  return { plugin, keys, key, a, got, fire, lowest };
}

beforeEach(() => vi.stubGlobal("window", new EventTarget()));
afterEach(() => vi.unstubAllGlobals());

describe("laptop octaves", () => {
  it("on Twinkle's range k stays 0, and Z and X are refused", () => {
    const { plugin, key, a, lowest } = setup(song("twinkle"));
    const v = { lo: 59, hi: 71 }; // the padded range makeLayout gives Twinkle (60..69)
    plugin.draw!(canvas().ctx, frame(v));
    key("KeyX");
    key("KeyZ");
    plugin.draw!(canvas().ctx, frame(v));
    expect(a("on")).toBe(lowest);
    expect(plugin.startPanel!({ chart: song("twinkle"), params: new URLSearchParams() })).toBeNull();
  });

  it("follows a view that jumps from C2 to C6, ending every frame with enough keys on screen", () => {
    const furElise = song("fur-elise");
    const { plugin, a, lowest } = setup(furElise);
    const map = laptopMap(lowest);
    const views = [{ lo: 36, hi: 62 }, { lo: 84, hi: 108 }, { lo: 84, hi: 108 }, { lo: 36, hi: 62 }];
    const ks: number[] = [];
    for (const v of views) {
      plugin.draw!(canvas().ctx, frame(v));
      const k = (a("on") - lowest) / 12;
      a("off");
      ks.push(k);
      expect(onScreen(map, k, v)).toBeGreaterThanOrEqual(octaveSettings.minKeys);
    }
    expect(ks).toEqual([0, 4, 4, 0]);
  });

  it("Z and X move an octave only where enough keys stay on screen; not on repeat, with Ctrl, or while paused", () => {
    const { plugin, key, a, lowest } = setup(song("chopin-prelude-4")); // 47..74: room above for one octave
    plugin.draw!(canvas().ctx, frame({ lo: 45, hi: 76 }));
    key("KeyX", { repeat: true });
    key("KeyX", { ctrlKey: true });
    plugin.onEvent!({ type: "pause" } as never);
    key("KeyX");
    expect(a("on")).toBe(lowest);
    plugin.onEvent!({ type: "resume" } as never);
    key("KeyX");
    expect(a("on")).toBe(lowest + 12);
    key("KeyX"); // a second octave up leaves too few keys on screen
    expect(a("on")).toBe(lowest + 12);
    key("KeyZ");
    expect(a("on")).toBe(lowest);
  });

  it("a release releases the pitch its press played, even after a follow", () => {
    const { plugin, a, lowest } = setup(song("fur-elise"));
    plugin.draw!(canvas().ctx, frame({ lo: 36, hi: 62 }));
    expect(a("on")).toBe(lowest);
    plugin.draw!(canvas().ctx, frame({ lo: 84, hi: 108 })); // k moves while A is held
    expect(a("off")).toBe(lowest);
    expect(a("on")).toBe(lowest + 48);
  });

  it("passes MIDI through unchanged, and draws nothing after the first MIDI note-on", () => {
    const { plugin, fire, got } = setup(song("fur-elise"));
    const c = canvas();
    plugin.draw!(c.ctx, frame({ lo: 36, hi: 62 }));
    expect(c.filled.length).toBeGreaterThan(0);
    const events: InputEvent[] = [
      { type: "off", pitch: 64, velocity: 0, timeMs: 1 },
      { type: "on", pitch: 64, velocity: 70, timeMs: 2 },
    ];
    for (const e of events) fire.midi(e);
    expect(got.slice(-2)).toEqual(events);
    const after = canvas();
    plugin.draw!(after.ctx, frame({ lo: 84, hi: 108 }));
    expect(after.filled).toEqual([]);
  });

  it("follow moves to the position with the most keys on screen, and stays when none reach the view", () => {
    const map = laptopMap(48); // C3..E4
    expect(follow(map, 0, { lo: 48, hi: 64 })).toBe(0);
    expect(follow(map, 0, { lo: 36, hi: 40 })).toBe(-1); // only an octave down reaches C2..E2
    expect(follow(map, 0, { lo: 200, hi: 220 })).toBe(0); // all positions score 0: the nearest is k itself
    expect(canMove(map, 0, -1, { lo: 36, hi: 64 })).toBe(true);
    expect(canMove(map, 0, 1, { lo: 36, hi: 64 })).toBe(false);
  });
});
