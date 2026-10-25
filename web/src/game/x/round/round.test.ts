import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { echoes, echoFilter, entryFor, programChanges, roundSettings, silence, type Played } from "./echo";

const chart = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../../public/songs/rounds/${id}/chart.json`, import.meta.url), "utf8"));

describe("the entries", () => {
  it("Frère Jacques: every 2 bars of 4/4 at 102, so voice 2 comes in 8 beats after you", () => {
    expect(entryFor(chart("frere-jacques"))).toEqual({ intervalMs: (8 * 60000) / 102, voices: 4 });
  });
  it("Row, Row: every 2 bars of 6/8, charted as 3 quarter beats a bar", () => {
    expect(entryFor(chart("row-your-boat"))).toEqual({ intervalMs: (6 * 60000) / 102, voices: 4 });
  });
  it("a chart with no round has none", () => {
    expect(entryFor({ ...chart("frere-jacques"), id: "twinkle" })).toBeNull();
  });
});

describe("the echoes", () => {
  const I = 4705.88;
  // A scripted take: two notes, each with its own velocity and length.
  const take: Played[] = [
    { type: "on", pitch: 65, velocity: 90, atMs: 0 },
    { type: "off", pitch: 65, velocity: 0, atMs: 550 },
    { type: "on", pitch: 67, velocity: 40, atMs: 588.2 },
    { type: "off", pitch: 67, velocity: 0, atMs: 1100 },
  ];
  const all = echoes(take, I, 4, -Infinity, Infinity);

  it("each press and release goes out at its time + k × the interval, k = 1, 2, 3, within ±2 ms", () => {
    for (const p of take)
      for (const k of [1, 2, 3]) {
        const s = all.find((e) => e.voice === k + 1 && e.bytes[1] === p.pitch && (e.bytes[0] & 0xf0) === (p.type === "on" ? 0x90 : 0x80) && Math.abs(e.atMs - (p.atMs + k * I)) <= 2);
        expect(s, `${p.type} ${p.pitch} voice ${k + 1}`).toBeDefined();
      }
    expect(all).toHaveLength(take.length * 3);
  });

  it("voice 2, 3 and 4 on MIDI channels 2, 3 and 4, never the player's channel 1", () => {
    expect(new Set(all.map((e) => (e.bytes[0] & 0x0f) + 1))).toEqual(new Set([2, 3, 4]));
    for (const e of all) expect((e.bytes[0] & 0x0f) + 1).toBe(e.voice);
  });

  it("each note keeps its own velocity and length", () => {
    const v3 = all.filter((e) => e.voice === 3);
    expect(v3.filter((e) => e.bytes[0] === 0x92).map((e) => [e.bytes[1], e.bytes[2]])).toEqual([[65, 90], [67, 40]]);
    const len = (pitch: number) => v3.find((e) => e.bytes[0] === 0x82 && e.bytes[1] === pitch)!.atMs - v3.find((e) => e.bytes[0] === 0x92 && e.bytes[1] === pitch)!.atMs;
    expect(len(65)).toBeCloseTo(550, 6);
    expect(len(67)).toBeCloseTo(511.8, 6);
  });

  it("only what falls inside the window goes out, each send once across windows", () => {
    const L = roundSettings.lookaheadMs;
    const windowed: number[] = [];
    for (let t = 0; t < 4 * I; t += 16) windowed.push(...echoes(take, I, 4, t, t + 16).map((e) => e.atMs));
    expect(windowed.sort((a, b) => a - b)).toEqual(all.map((e) => e.atMs));
    // What a Stop at now leaves already sent: only the lookahead.
    const now = I + 200;
    expect(echoes(take, I, 4, -Infinity, now + L).every((e) => e.atMs < now + L)).toBe(true);
  });

  it("programs for voices 2–4 on their channels, and silence on every channel used", () => {
    expect(programChanges(4)).toEqual([[0xc1, 48], [0xc2, 73], [0xc3, 52]]);
    expect(silence(4)).toContainEqual([0xb3, 123, 0]);
    expect(silence(4)).toContainEqual([0xb0, 64, 0]);
    expect(silence(4)).toHaveLength(8);
  });
});

describe("no feedback", () => {
  it("drops a note-on the piano echoed on channel 2 (same pitch and timestamp), and its note-off", () => {
    const f = echoFilter();
    f.heard(0x91, 65, 90, 1000.25);
    expect(f.drop("on", 65, 1000.25)).toBe(true);
    expect(f.drop("off", 65, 1300)).toBe(true);
    expect(f.counts()).toEqual({ received: 1, filtered: 1 });
  });

  it("the echo guard drops a channel-1 copy within its window of a send, and keeps a real press outside it", () => {
    const f = echoFilter();
    f.sent(67, 5000);
    expect(f.drop("on", 67, 5000 + roundSettings.echoWindowMs - 1)).toBe(true);
    expect(f.drop("off", 67, 5200)).toBe(true);
    expect(f.drop("on", 67, 5000 + roundSettings.echoWindowMs + 20)).toBe(false); // the player's own press: judged
    expect(f.drop("off", 67, 5400)).toBe(false);
  });

  it("the player's own channel-1 note is never taken for an echo, whatever its timestamp", () => {
    const f = echoFilter();
    f.heard(0x90, 60, 80, 2000);
    expect(f.drop("on", 60, 2000)).toBe(false);
    expect(f.counts().received).toBe(0);
  });
});
