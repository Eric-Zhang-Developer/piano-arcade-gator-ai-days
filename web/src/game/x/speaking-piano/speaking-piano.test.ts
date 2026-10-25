import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analysisDefaults, analyze, keyHz } from "./analysis";
import { micHold } from "./mic";
import { phraseMessages, play, silenceOnPagehide, type PlayFrame } from "./playback";
import { NoteLines, Speak, type Note } from "./Speak";

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

  it("Stop mid-phrase: every note-on has a later note-off or All Notes Off on its channel (#1311)", () => {
    vi.useFakeTimers();
    let t = 0;
    const sent: { bytes: number[]; at: number }[] = [];
    const long: PlayFrame[] = Array.from({ length: 40 }, (_, k) => ({ tMs: k * 83, strikes: [[60 + (k % 12), 90]] }));
    const p = play({ send: (bytes, at = t) => sent.push({ bytes, at }) }, phraseMessages(long, 83, 120, { velCap: 100, n: 14 }), () => t);
    for (; t < 1000; t += 25) vi.advanceTimersByTime(25);
    p.stop();
    const ons = sent.filter((m) => (m.bytes[0] & 0xf0) === 0x90);
    expect(ons.length).toBeGreaterThan(0);
    for (const on of ons) {
      const ch = on.bytes[0] & 0x0f;
      const off = (m: (typeof sent)[number]) =>
        m.at >= on.at && ((m.bytes[0] === (0x80 | ch) && m.bytes[1] === on.bytes[1]) || (m.bytes[0] === (0xb0 | ch) && m.bytes[1] === 123));
      expect(sent.some(off), `note-on ${on.bytes[1]} at ${on.at}`).toBe(true);
    }
  });

  it("Stop clears the queue and silences now and after the lookahead; leaving the page stops it", () => {
    vi.useFakeTimers();
    const sent: number[][] = [];
    let cleared = false;
    const p = play({ send: (b) => sent.push(b), clear: () => (cleared = true) }, phraseMessages(frames, 83, 10_000, { velCap: 100, n: 14 }), () => 0);
    const page = new EventTarget();
    const off = silenceOnPagehide(page, () => p.stop());
    page.dispatchEvent(new Event("pagehide"));
    off();
    expect(cleared).toBe(true);
    expect(sent.filter((b) => b[1] === 123)).toHaveLength(32);
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

describe("leaving mid-hold (speak-polish, #1201)", () => {
  afterEach(() => vi.useRealTimers());
  const stubMic = () => {
    const mic = { stopped: 0, stop: () => (mic.stopped++, { samples: new Float32Array(SR), rate: SR }) };
    return mic;
  };

  it("tearing down mid-hold stops the mic, and 3 s later nothing plays", async () => {
    vi.useFakeTimers();
    const mic = stubMic();
    const onTake = vi.fn();
    const hold = micHold(async () => mic, 3000, onTake);
    await hold.down();
    vi.advanceTimersByTime(1000);
    hold.dispose();
    vi.advanceTimersByTime(5000);
    expect(mic.stopped).toBe(1);
    expect(onTake).not.toHaveBeenCalled();
  });

  it("a mic still opening when the page goes is stopped as it arrives, with no timer", async () => {
    vi.useFakeTimers();
    const mic = stubMic();
    let resolve!: (m: typeof mic) => void;
    const onTake = vi.fn();
    const hold = micHold(() => new Promise((r) => (resolve = r)), 3000, onTake);
    const down = hold.down();
    hold.dispose();
    resolve(mic);
    await down;
    vi.advanceTimersByTime(5000);
    expect(mic.stopped).toBe(1);
    expect(onTake).not.toHaveBeenCalled();
  });

  it("without leaving, the take still ends at 3 s or on release, once", async () => {
    vi.useFakeTimers();
    const mic = stubMic();
    const onTake = vi.fn();
    const hold = micHold(async () => mic, 3000, onTake);
    await hold.down();
    vi.advanceTimersByTime(3000);
    hold.up();
    expect(onTake).toHaveBeenCalledTimes(1);
    expect(mic.stopped).toBe(1);
  });
});

describe("the page's type and notes (speak-polish, #1202, #1203)", () => {
  it("nothing resolves under the kit's 12 px at 1280×720 (16 px base), the canvas's octave names included", () => {
    const tsx = readFileSync(join(__dirname, "Speak.tsx"), "utf8");
    const css = readFileSync(join(__dirname, "speak.module.css"), "utf8");
    const base = 16; // clamp(14px, 1.25vw, 28px) at 1280
    // Each rule's em size on the page's base; .dim sits inside .subtitle, whose own size is read from the file.
    const emOf = (sel: string) => Number(new RegExp(`\\${sel} \\{[^}]*font(?:-size)?:[^;]*?(\\d*\\.?\\d+)em`).exec(css)?.[1]);
    const parent: Record<string, number> = { ".dim": emOf(".subtitle") };
    expect(parent[".dim"]).toBe(2.6);
    for (const [, sel, body] of css.matchAll(/([.\w :-]+)\{([^}]*)\}/g))
      for (const m of body.matchAll(/font(?:-size)?:\s*(?:\d+ )?(\d*\.?\d+)em/g))
        expect(Number(m[1]) * base * (parent[sel.trim()] ?? 1), `${sel.trim()} ${m[0]}`).toBeGreaterThanOrEqual(12);
    for (const m of tsx.matchAll(/fontSize: "(\d*\.?\d+)em"/g)) expect(Number(m[1]) * base, m[0]).toBeGreaterThanOrEqual(12);
    for (const m of `${css}\n${tsx}`.matchAll(/max\((\d+)px/g)) expect(Number(m[1]), m[0]).toBeGreaterThanOrEqual(12);
    expect(tsx).toMatch(/canvasFonts\.data\(Math\.max\(12,/);
  });

  it("an error is an alert, a hint a polite status that's there before it's needed, and the way back reads Back to the Lab", () => {
    const md = (note: Note | null) => renderToStaticMarkup(createElement(NoteLines, { note }));
    expect(md({ text: "No piano output: plug in the DGX.", alert: true })).toMatch(/role="alert"[^>]*>No piano output/);
    expect(md({ text: "Hold Speak a little longer, then let go.", alert: false })).toMatch(/role="status"[^>]*>Hold Speak a little longer/);
    expect(md(null)).toMatch(/role="status"[^>]*><\/p>$/);
    const page = renderToStaticMarkup(createElement(Speak));
    expect(page).toMatch(/<a[^>]*href="\/lab"[^>]*>Back to the Lab<\/a>/);
    expect(page).toMatch(/role="status"/);
  });
});
