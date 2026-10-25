import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, Frame, Judgment } from "../../contracts";
import { hintTimer, waitHint, waitingNotes } from ".";

// 60 bpm: beat n at n s. A right-hand note at beat 1, then a two-hand chord at beat 2.
const chart: Chart = {
  id: "t",
  title: "t",
  bpm: 60,
  beatsPerBar: 4,
  notes: [
    { id: "a", pitch: 60, beat: 1, duration: 1, hand: "R" },
    { id: "b", pitch: 64, beat: 2, duration: 1, hand: "R" },
    { id: "c", pitch: 48, beat: 2, duration: 1, hand: "L" },
  ],
} as Chart;

describe("waitingNotes", () => {
  it("a chord with one key pressed waits on the other key", () => {
    const hits = new Map<string, Judgment>([["a", "PERFECT"], ["b", "PERFECT"]]);
    expect(waitingNotes(chart, hits, 2000).map((n) => n.pitch)).toEqual([48]);
    expect(waitingNotes(chart, new Map([["a", "PERFECT"]]), 2000).map((n) => n.pitch)).toEqual([48, 64]); // lowest first
    expect(waitingNotes(chart, new Map(), 500)).toEqual([]); // nothing due yet
  });

  it("after a rewind's →, a skipped note before the floor isn't waited on (rewind)", () => {
    expect(waitingNotes(chart, new Map(), 2000, 1500).map((n) => n.pitch)).toEqual([48, 64]); // not a, skipped at 1000
  });
});

describe("hintTimer", () => {
  it("is due at 3000 ms of wall time, not 2999, sounds once, and starts over at the next note", () => {
    const t = hintTimer();
    expect(t.frame("1000", 10_000).show).toBe(false); // the hold begins
    expect(t.frame("1000", 12_999).show).toBe(false);
    expect(t.frame("1000", 13_000)).toMatchObject({ show: true, sound: true });
    expect(t.frame("1000", 16_000)).toMatchObject({ show: true, sound: false });
    expect(t.frame("", 16_100).show).toBe(false); // pressed: the clock runs on
    expect(t.frame("2000", 17_000).show).toBe(false);
    expect(t.frame("2000", 20_000)).toMatchObject({ show: true, sound: true });
  });

  it("a pause at 2000 ms and a resume give a hint 3000 ms after the resume, not 1000", () => {
    const t = hintTimer();
    t.frame("1000", 0);
    t.frame("1000", 2000);
    t.pause();
    expect(t.frame("1000", 9000).show).toBe(false); // paused: no hint however long
    t.resume(10_000);
    expect(t.frame("1000", 11_000).show).toBe(false);
    expect(t.frame("1000", 12_999).show).toBe(false);
    expect(t.frame("1000", 13_000)).toMatchObject({ show: true, sound: true });
  });

  it("after a resume, a hint that already sounded may sound once more", () => {
    const t = hintTimer();
    t.frame("1000", 0);
    expect(t.frame("1000", 3000).sound).toBe(true);
    t.pause();
    t.resume(5000);
    expect(t.frame("1000", 8000).sound).toBe(true);
    expect(t.frame("1000", 8100).sound).toBe(false);
  });
});

describe("the plugin without mode=wait", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("draws nothing and sends nothing", () => {
    const requestMIDIAccess = vi.fn();
    vi.stubGlobal("navigator", { requestMIDIAccess });
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_, k) => () => calls.push(String(k)), set: () => true }) as unknown as CanvasRenderingContext2D;
    const p = waitHint();
    p.transformChart!(chart, new URLSearchParams("song=t"));
    p.onEvent!({ type: "songStart", atMs: 0 });
    const frame = { nowMs: 2000, judgmentLineY: 600, width: 1000, height: 720, lowPitch: 48, highPitch: 64, keyX: () => ({ x: 0, width: 10 }) } as Frame;
    p.draw!(ctx, frame);
    expect(calls).toEqual([]);
    expect(requestMIDIAccess).not.toHaveBeenCalled();
  });
});
