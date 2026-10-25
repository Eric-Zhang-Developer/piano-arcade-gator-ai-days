import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analysisDefaults, analyze, keyHz } from "./analysis";
import { phraseMessages, play, silenceOnPagehide, type PlayFrame } from "./playback";

const SR = 22050;
const tone = (hz: number, s = 1) => Float32Array.from({ length: SR * s }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / SR));

describe("the analysis", () => {
  it("lights the key whose fundamental a pure tone is on", () => {
    for (const key of [57, 64, 76]) {
      const a = analyze(tone(keyHz(key)), SR, { ...analysisDefaults, n: 1 });
      const mid = a.frames.slice(2, -2);
      expect(mid.every((f) => f.strikes.length === 1 && f.strikes[0].key === key)).toBe(true);
    }
  });

  it("turns a noise burst into a soft top-octave cluster", () => {
    let seed = 3;
    const noise = Float32Array.from({ length: SR }, () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31) * 2 - 1);
    const a = analyze(noise, SR, analysisDefaults);
    const mid = a.frames.slice(2, -2);
    expect(mid.every((f) => f.fricative)).toBe(true);
    expect(mid.every((f) => [96, 100, 104].every((k) => f.strikes.some((s) => s.key === k)))).toBe(true);
  });

  it("strikes at most n keys a frame, every velocity within the cap", () => {
    const chord = Float32Array.from(tone(220), (v, i) => v + 0.4 * Math.sin((2 * Math.PI * 330 * i) / SR) + 0.3 * Math.sin((2 * Math.PI * 1320 * i) / SR));
    const a = analyze(chord, SR, { ...analysisDefaults, n: 4, velCap: 90 });
    for (const f of a.frames) {
      expect(f.strikes.length).toBeLessThanOrEqual(4);
      for (const s of f.strikes) expect(s.vel).toBeLessThanOrEqual(90);
    }
  });
});

describe("playback", () => {
  afterEach(() => vi.useRealTimers());
  const frames: PlayFrame[] = [
    { tMs: 0, strikes: [[60, 127], [64, 80], [67, 70], [72, 60]] },
    { tMs: 83, strikes: [[60, 127]] },
    { tMs: 167, strikes: [] },
  ];

  it("caps velocity and notes a frame, whatever the table holds", () => {
    const m = phraseMessages(frames, 83, 1000, { velCap: 100, n: 3 });
    const ons = m.filter((x) => x.bytes[0] === 0x90);
    expect(Math.max(...ons.map((x) => x.bytes[2]))).toBe(100);
    expect(ons.filter((x) => x.atMs === 1000)).toHaveLength(3);
  });

  it("schedules each frame's note-ons at its start, ±2 ms, as the output receives them", () => {
    vi.useFakeTimers();
    let t = 5000;
    const sent: { bytes: number[]; at?: number }[] = [];
    const p = play({ send: (bytes, at) => sent.push({ bytes, at }) }, phraseMessages(frames, 83, 5120, { velCap: 100, n: 14 }), () => t);
    for (let i = 0; i < 40; i++) {
      t += 25;
      vi.advanceTimersByTime(25);
    }
    const ons = sent.filter((s) => s.bytes[0] === 0x90);
    // Frame starts are 5120 + tMs; the spec allows ±2 ms, the timestamps are exact.
    const starts = ons.map((s) => s.at! - 5120);
    expect(starts).toEqual([0, 0, 0, 0, 83]);
    p.stop();
  });

  it("ends in All Notes Off on every channel and pedal up", () => {
    const m = phraseMessages(frames, 83, 0, { velCap: 100, n: 14 });
    const tail = m.slice(-17).map((x) => x.bytes);
    expect(tail.slice(0, 16)).toEqual([...Array(16).keys()].map((ch) => [0xb0 + ch, 123, 0]));
    expect(tail[16]).toEqual([0xb0, 64, 0]);
  });

  it("Stop clears the queue and silences now; leaving the page stops it", () => {
    vi.useFakeTimers();
    const sent: number[][] = [];
    let cleared = false;
    const p = play({ send: (b) => sent.push(b), clear: () => (cleared = true) }, phraseMessages(frames, 83, 10_000, { velCap: 100, n: 14 }), () => 0);
    const page = new EventTarget();
    const off = silenceOnPagehide(page, () => p.stop());
    page.dispatchEvent(new Event("pagehide"));
    off();
    expect(cleared).toBe(true);
    expect(sent.filter((b) => b[1] === 123)).toHaveLength(16);
    expect(sent.at(-1)).toEqual([0xb0, 64, 0]);
  });
});

describe("mic privacy", () => {
  it("nothing in the folder can send audio anywhere: no fetch, XHR, WebSocket, beacon or EventSource", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(join(dir, f), "utf8")).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|\.postMessage\(/);
  });
});
