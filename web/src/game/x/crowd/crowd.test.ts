import { readdirSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputEvent } from "../../../contracts";
import { ClapDetector, crowdSettings, detect } from "./dsp";
import { evaluate, noteOnSamples, twinkle } from "./fixtures";
import { crowd, crowdRoom } from ".";
import { clapSettings, crowdMix } from "./mix";
import { pickGrid, roomLine, scoreRoom } from "./score";
import { processorSource, workletName } from "./worklet";

const RATE = 48000;
const everyBeat = Array.from({ length: 48 }, (_, i) => i);
const notes = noteOnSamples(twinkle, RATE);
const report = (line: string) => process.stderr.write(`crowd: ${line}\n`);

afterEach(() => vi.unstubAllGlobals());

// The mixes are seconds of audio synthesized and scanned in JS: on a busy machine that outruns the 5 s default.
const heavy = { timeout: 60_000 };

describe("(a) detection on known-time mixes, over the laptop voice playing twinkle", heavy, () => {
  // The level: each clap's RMS over its first 20 ms against the bed's RMS over the notes' span (mix.ts).
  const levels = [0, -6, -12].map((db) => {
    const runs = [1, 2, 3].map((seed) => {
      const m = crowdMix(twinkle, everyBeat, db, seed, RATE);
      return evaluate(detect(m.samples, RATE, crowdSettings, notes), m.claps, RATE);
    });
    const P = Math.min(...runs.map((r) => r.P));
    const R = Math.min(...runs.map((r) => r.R));
    const med = Math.max(...runs.map((r) => r.medAbs));
    report(`${db} dB: precision ${P.toFixed(3)}, recall ${R.toFixed(3)}, median |error| ${med.toFixed(1)} ms (worst of 3 seeds)`);
    return { db, P, R, med };
  });

  it("at −6 dB: precision and recall 90% or more, median |error| 15 ms or less", () => {
    const at6 = levels.find((l) => l.db === -6)!;
    expect(at6.P).toBeGreaterThanOrEqual(0.9);
    expect(at6.R).toBeGreaterThanOrEqual(0.9);
    expect(at6.med).toBeLessThanOrEqual(15);
  });

  it("reports the stress bed too: a hammer burst at every strike, which the laptop voice doesn't have", () => {
    const runs = [1, 2, 3].map((seed) => {
      const m = crowdMix(twinkle, everyBeat, -6, seed, RATE, undefined, { hammer: 1 });
      return evaluate(detect(m.samples, RATE, crowdSettings, notes), m.claps, RATE);
    });
    report(`stress bed, −6 dB: precision ${Math.min(...runs.map((r) => r.P)).toFixed(3)}, recall ${Math.min(...runs.map((r) => r.R)).toFixed(3)} (worst of 3; decision crowd-onsets)`);
    expect(runs.length).toBe(3);
  });

  it("the raised threshold near a note-on never blanks a clap struck with it", () => {
    // claps exactly on the beats where twinkle has notes: every one sits inside a raised window
    const onNotes = [...new Set(twinkle.notes.map((n) => n.beat))];
    const m = crowdMix(twinkle, onNotes, -6, 5, RATE, { ...clapSettings, jitterMs: 0 });
    const r = evaluate(detect(m.samples, RATE, { ...crowdSettings, noteRaise: 2 }, notes), m.claps, RATE);
    expect(r.R).toBe(1);
  });

  it("a clap is called within one block of the frame it peaks in", () => {
    const m = crowdMix(twinkle, [8], -6, 3, RATE);
    const d = new ClapDetector(RATE, crowdSettings);
    let calledAt = -1;
    for (let i = 0; i < m.samples.length && calledAt < 0; i += 128) if (d.push(m.samples.subarray(i, i + 128)).length) calledAt = i + 128;
    expect((calledAt / RATE - m.claps[0]) * 1000).toBeLessThan(30);
  });
});

describe("the room's score on the beat grid", () => {
  const msPerBeat = 60000 / 100;
  it("on the beat is within ±60 ms, and each clap keeps its signed error", () => {
    const r = scoreRoom([0, 600 + 59, 1200 - 61, 1800 + 120], 100, 4);
    expect(r.grid).toBe("every");
    expect(r.errors.map(Math.round)).toEqual([0, 59, -61, 120]);
    expect(r.onBeat).toBe(2);
    expect(roomLine(r)).toBe("ROOM 50% ON BEAT · 4 claps");
  });

  it("picks the backbeat from claps on 2 and 4, and every beat from claps on all four", () => {
    const backbeat = Array.from({ length: 16 }, (_, i) => (2 * i + 1) * msPerBeat + (i % 3) * 10);
    const all = Array.from({ length: 16 }, (_, i) => i * msPerBeat - (i % 3) * 10);
    expect(pickGrid(backbeat, 100, 4)).toBe("backbeat");
    expect(scoreRoom(backbeat, 100, 4).share).toBe(1);
    expect(pickGrid(all, 100, 4)).toBe("every");
    // claps on 1 and 3 against the backbeat grid would all be off: with every beat they're on
    expect(scoreRoom(all, 100, 4).share).toBe(1);
    // 3/4 has no backbeat
    expect(pickGrid(backbeat, 100, 3)).toBe("every");
  });
});

describe("the room never reaches the player's game", () => {
  it("passes every input event through untouched and leaves the chart as it is", async () => {
    const p = crowd.plugin();
    expect(p.transformChart!(twinkle, new URLSearchParams())).toBe(twinkle);
    const sent: InputEvent[] = [{ type: "on", pitch: 60, velocity: 90, timeMs: 10 }, { type: "off", pitch: 60, velocity: 0, timeMs: 200 }];
    const inner = { kind: "test" as const, start: (on: (e: InputEvent) => void) => sent.forEach(on), stop: () => {} };
    const got: InputEvent[] = [];
    await p.wrapInput!(inner).start((e) => got.push(e));
    expect(got).toEqual(sent);
    expect(got[0]).toBe(sent[0]);
  });

  it("imports nothing that keeps score, judges or saves a take", () => {
    const src = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.filter((i) => /judge|score-|records|take|storage|supabase|api/.test(i))).toEqual([]);
  });
});

describe("privacy: the audio stays in memory", () => {
  it("no network or storage call anywhere in the experiment's source", () => {
    const dir = new URL("./", import.meta.url);
    for (const f of readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."))) {
      const src = readFileSync(new URL(f, dir), "utf8");
      expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|MediaRecorder/);
    }
  });

  it("scoring a take's claps makes no request", () => {
    const calls = vi.fn();
    vi.stubGlobal("fetch", calls);
    vi.stubGlobal("XMLHttpRequest", calls);
    vi.stubGlobal("WebSocket", calls);
    vi.stubGlobal("navigator", { sendBeacon: calls });
    const room = crowdRoom(100, 4);
    for (let i = 0; i < 20; i++) room.clap(i * 600 + 7, i * 600);
    const p = crowd.plugin();
    p.onEvent!({ type: "songStart", atMs: 0 });
    p.onEvent!({ type: "songEnd", atMs: 1000, results: {} as never });
    expect(room.score.claps).toBe(20);
    expect(calls).not.toHaveBeenCalled();
  });
});

describe("the worklet", () => {
  it("runs the detector's own text, and posts only clap times", () => {
    const posted: unknown[] = [];
    let Proc: (new () => { process(i: Float32Array[][]): boolean; port: { postMessage(m: unknown): void } }) | null = null;
    class AudioWorkletProcessor {
      port = { postMessage: (m: unknown) => posted.push(m), onmessage: null as unknown };
    }
    new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", "currentFrame", processorSource())(
      AudioWorkletProcessor,
      (name: string, c: typeof Proc) => name === workletName && (Proc = c),
      RATE,
      0,
    );
    const node = new Proc!();
    const m = crowdMix(twinkle, [4, 8], -6, 2, RATE);
    for (let i = 0; i < m.samples.length; i += 128) node.process([[m.samples.subarray(i, i + 128)]]);
    expect(posted).toHaveLength(2);
    for (const [k, msg] of posted.entries()) expect(Math.abs((msg as { clap: number }).clap - m.claps[k]) * 1000).toBeLessThan(15);
  });
});

describe("(b) CPU", heavy, () => {
  it("each 128-sample block's work is under 30% of the block's budget (offline, node: 3 runs)", () => {
    const m = crowdMix(twinkle, everyBeat, -6, 1, RATE);
    const budget = (128 / RATE) * 1000;
    const runs = [0, 1, 2].map(() => {
      const d = new ClapDetector(RATE, crowdSettings);
      const times: number[] = [];
      for (let i = 0; i + 128 <= m.samples.length; i += 128) {
        const block = m.samples.subarray(i, i + 128);
        const t0 = performance.now();
        d.push(block);
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return { mean: times.reduce((a, b) => a + b, 0) / times.length, p99: times[Math.floor(times.length * 0.99)] };
    });
    report(`CPU per block (budget ${budget.toFixed(2)} ms): ${runs.map((r) => `mean ${((r.mean / budget) * 100).toFixed(2)}%, p99 ${((r.p99 / budget) * 100).toFixed(2)}%`).join(" | ")}`);
    for (const r of runs) expect(r.mean / budget).toBeLessThan(0.3);
  });
});
