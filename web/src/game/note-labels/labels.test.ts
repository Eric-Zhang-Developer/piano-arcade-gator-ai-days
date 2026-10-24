import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Frame, InputDevice, InputEvent } from "../../contracts";
import { keyMap } from "../core/input";
import { noteLabels, setLaptopShift } from ".";
import { fitsLane, labelMode, labelSetting, laptopLetters, nextSetting, noteName } from "./labels";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

// Draws one frame of the plugin and returns what it wrote. Lanes are `width` px; notes are off screen (nowMs far back).
function drawn(plugin: ReturnType<typeof noteLabels>, width = 40): string[] {
  const written: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) =>
      k === "fillText" ? (s: string) => written.push(s) : k === "measureText" ? (s: string) => ({ width: s.length * 7 }) : k in t ? t[k as string] : () => {},
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  const frame: Frame = {
    nowMs: -10_000, lowPitch: 60, highPitch: 61, judgmentLineY: 500, width: 2 * width, height: 600,
    keyX: (p) => ({ x: (p - 60) * width, width }),
  };
  plugin.draw!(ctx, frame);
  return written;
}

describe("note labels", () => {
  it("names 60, 61 and 71 C4, C♯ and B; every C carries its octave", () => {
    expect([60, 61, 71, 72, 48, 21].map(noteName)).toEqual(["C4", "C♯", "B", "C5", "C3", "A"]);
  });

  it("gives Twinkle's keys the laptop letters keyMap plays them with", () => {
    const lowest = Math.min(...twinkle.notes.map((n) => n.pitch));
    const letters = laptopLetters(lowest);
    for (const [code, pitch] of keyMap(lowest)) expect(letters.get(pitch)).toBe(code === "Semicolon" ? ";" : code.slice(3));
    expect(letters.get(lowest)).toBe("A");
  });

  it("takes the URL over storage over auto, and cycles auto, notes, keys, off", () => {
    expect(labelSetting("off", "notes")).toBe("off");
    expect(labelSetting(null, "notes")).toBe("notes");
    expect(labelSetting("bogus", null)).toBe("auto");
    expect(["auto", "notes", "keys", "off"].map((s) => nextSetting(s as never))).toEqual(["notes", "keys", "off", "auto"]);
  });

  it("auto shows laptop letters until the first MIDI note-on, then letter names", () => {
    expect(labelMode("auto", false)).toBe("keys");
    expect(labelMode("auto", true)).toBe("notes");
    expect(labelMode("keys", true)).toBe("keys");

    const plugin = noteLabels();
    plugin.transformChart!(twinkle, new URLSearchParams());
    const fire: Record<string, (e: InputEvent) => void> = {};
    const fake = (kind: InputDevice["kind"]): InputDevice => ({ kind, start: (on) => void (fire[kind] = on), stop: () => {} });
    for (const kind of ["keys", "midi"] as const) void plugin.wrapInput!(fake(kind)).start(() => {});
    fire.keys({ type: "on", pitch: 60, velocity: 80, timeMs: 0 });
    fire.keys({ type: "off", pitch: 60, velocity: 0, timeMs: 0 });
    expect(drawn(plugin)).toEqual(["A", "W"]); // laptop letters for C4 and C♯4
    fire.midi({ type: "off", pitch: 60, velocity: 0, timeMs: 1 }); // a release isn't a note-on
    expect(drawn(plugin)).toEqual(["A", "W"]);
    fire.midi({ type: "on", pitch: 60, velocity: 64, timeMs: 2 });
    fire.midi({ type: "off", pitch: 60, velocity: 0, timeMs: 3 });
    expect(drawn(plugin)).toEqual(["C4", "C♯"]);
  });

  it("hides a label wider than its lane", () => {
    expect(fitsLane(10, 14)).toBe(true);
    expect(fitsLane(13, 14)).toBe(false);

    // Drawn: a 12 px lane can't hold "C♯" at 10 px (about 14 px wide), so nothing is written for it.
    const plugin = noteLabels();
    plugin.transformChart!(twinkle, new URLSearchParams("labels=notes"));
    expect(drawn(plugin, 40)).toEqual(["C4", "C♯"]);
    expect(drawn(plugin, 12)).toEqual([]);
    plugin.transformChart!(twinkle, new URLSearchParams("labels=off"));
    expect(drawn(plugin, 40)).toEqual([]);
  });

  it("moves the laptop letters with setLaptopShift, and back at 0", () => {
    const plugin = noteLabels();
    plugin.transformChart!(twinkle, new URLSearchParams("labels=keys"));
    expect(drawn(plugin)).toEqual(["A", "W"]);
    setLaptopShift(-12); // the map an octave down: C4 and C♯4 are now K and O
    expect(drawn(plugin)).toEqual(["K", "O"]);
    setLaptopShift(12); // an octave up: nothing at C4
    expect(drawn(plugin)).toEqual([]);
    setLaptopShift(0);
    expect(drawn(plugin)).toEqual(["A", "W"]);
  });
});
