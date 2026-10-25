import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../../contracts";
import { msPerBeat } from "../../core/settings";
import { parsePedal } from "../../pedal";
import { actionSettings as S, approachMs, flightMs, KeyAction, Rail, railFor, ring, type Phase } from "./action";
import { schedule, sendsIn } from "./schedule";

const read = (f: string) => JSON.parse(readFileSync(new URL(`../../../../public/songs/moonlight-1/${f}`, import.meta.url), "utf8"));
const phases = (k: KeyAction, from: number, to: number, step = 0.5) => {
  const seen: Phase[] = [];
  for (let t = from; t <= to; t += step) if (seen.at(-1) !== k.pose(t).phase) seen.push(k.pose(t).phase);
  return seen;
};

describe("one key's stroke (inside)", () => {
  it("runs approach, let-off, flight, strike, rebound, check, repetition, return, rest, in order and in time", () => {
    const k = new KeyAction();
    const v = 80;
    k.press(1000, v, true);
    k.release(1400);
    const start = 1000 - approachMs(v);
    expect(phases(k, start - 10, 1400 + S.keyUpMs + S.dropMs + 10)).toEqual(["rest", "approach", "flight", "strike", "rebound", "checked", "repetition", "return", "rest"]);
    // Each phase inside its logged range.
    expect(k.pose(1000 - flightMs(v) - 0.5).phase).toBe("approach");
    expect(k.pose(1000 - flightMs(v) + 0.5).phase).toBe("flight");
    expect(k.pose(1000 - flightMs(v)).hammer).toBeCloseTo(S.letOff, 5);
    expect(k.pose(1000 + S.strikeMs + S.reboundMs + 1)).toMatchObject({ phase: "checked", hammer: S.check, key: 1 });
    expect(k.pose(1400 + S.keyUpMs - 1).phase).toBe("repetition");
    expect(k.pose(1400 + S.keyUpMs + S.dropMs + 1)).toEqual({ key: 0, hammer: 0, damper: 0, phase: "rest" });
  });

  it("the damper starts to lift at half the key's dip", () => {
    const k = new KeyAction();
    k.press(1000, 64, true);
    const s = 1000 - approachMs(64);
    const at = (key: number) => s + key * (1000 - s); // the key goes down linearly over the approach
    expect(k.pose(at(0.49)).damper).toBe(0);
    expect(k.pose(at(0.55)).damper).toBeGreaterThan(0);
    expect(k.pose(1000).damper).toBe(1);
  });

  it("a re-press before the key is back re-strikes without the hammer or key passing through rest", () => {
    for (const ahead of [false, true]) {
      const k = new KeyAction();
      k.press(1000, 90, ahead);
      k.release(1200);
      const again = 1200 + S.keyUpMs * 0.6;
      k.press(again, 90, ahead);
      let lowest = Infinity;
      let lowestKey = Infinity;
      for (let t = 1200; t <= again; t += 0.5) {
        lowest = Math.min(lowest, k.pose(t).hammer);
        lowestKey = Math.min(lowestKey, k.pose(t).key);
      }
      expect(lowest, ahead ? "playback" : "live").toBeGreaterThan(S.check - 1e-9);
      expect(lowestKey).toBeGreaterThan(0);
      expect(k.pose(again).hammer).toBe(1);
    }
  });

  it("in live mode no approach is drawn before a note-on: rest until it, at the string at it", () => {
    const k = new KeyAction();
    k.press(1000, 127);
    for (let t = 0; t < 1000; t += 1) expect(k.pose(t)).toEqual({ key: 0, hammer: 0, damper: 0, phase: "rest" });
    expect(k.pose(1000)).toMatchObject({ hammer: 1, key: 1, phase: "strike" });
  });

  it("in playback the approach ends exactly at the send time", () => {
    for (const v of [1, 40, 127]) {
      const k = new KeyAction();
      k.press(5000, v, true);
      expect(k.pose(5000).hammer).toBe(1);
      expect(k.pose(5000 - 0.01).hammer).toBeLessThan(1);
      expect(k.pose(5000 - approachMs(v) + 0.01).phase).toBe("approach");
    }
  });

  it("a higher velocity gives a shorter flight and a shorter approach", () => {
    for (let v = 1; v < 127; v += 9) {
      expect(flightMs(v + 9)).toBeLessThan(flightMs(v));
      expect(approachMs(v + 9)).toBeLessThan(approachMs(v));
    }
  });
});

describe("the pedal (inside)", () => {
  it("CC64 maps to the rail monotonically, with a mid value at half pedal", () => {
    for (let v = 1; v <= 127; v++) expect(railFor(v)).toBeGreaterThanOrEqual(railFor(v - 1));
    expect(railFor(0)).toBe(0);
    expect(railFor(127)).toBe(1);
    expect(railFor(64)).toBeGreaterThan(0.3);
    expect(railFor(64)).toBeLessThan(0.7);
  });

  it("with the pedal down a released key's damper stays up; with it up the damper falls", () => {
    const k = new KeyAction();
    const rail = new Rail();
    rail.set(900, 127);
    k.press(1000, 80);
    k.release(1100);
    const after = 1100 + S.keyUpMs + S.dropMs + 50;
    expect(k.pose(after).damper).toBe(0); // the key's own damper is down
    expect(Math.max(k.pose(after).damper, rail.at(after))).toBe(1); // the rail holds it up
    rail.set(after + 10, 0);
    expect(rail.at(after + 10 + S.pedal.riseMs)).toBe(0);
  });

  it("the rail chains from where it was, and rises bass to treble as a wave", () => {
    const rail = new Rail();
    rail.set(0, 127);
    rail.set(S.pedal.riseMs / 2, 0); // lifted halfway, then let go
    expect(rail.at(S.pedal.riseMs / 2)).toBeCloseTo(0.5, 5);
    expect(rail.at(S.pedal.riseMs * 0.75)).toBeCloseTo(0.375, 5); // a quarter of riseMs down from 0.5
    const r2 = new Rail();
    r2.set(1000, 127);
    expect(r2.forKey(1030, 0)).toBeGreaterThan(r2.forKey(1030, 87));
    expect(r2.forKey(1000 + 87 * S.waveMsPerKey, 87)).toBe(0);
  });

  it("a string rings long with its damper up and dies fast with it down", () => {
    expect(ring(1, 100, 1)).toBeGreaterThan(0.9);
    expect(ring(1, 100, 0)).toBeLessThan(0.4);
  });
});

describe("Play Moonlight (inside)", () => {
  const chart: Chart = read("chart.json");
  const pedal = parsePedal(read("pedal.json"))!;
  const s = schedule(chart, pedal);
  const sends = sendsIn(s, -1, s.endMs + 1);
  const mpb = msPerBeat(chart.bpm);

  it("sends every chart note at its time and velocity, and every pedal pair as CC64 down and up", () => {
    const ons = sends.filter((x) => x.bytes[0] === 0x90);
    expect(ons.length).toBe(chart.notes.length);
    const want = chart.notes.map((n) => `${n.pitch}@${(n.beat * mpb).toFixed(3)}v${n.velocity}`).sort();
    expect(ons.map((x) => `${x.bytes[1]}@${x.atMs.toFixed(3)}v${x.bytes[2]}`).sort()).toEqual(want);
    expect(chart.notes.every((n) => typeof n.velocity === "number")).toBe(true);
    const cc = sends.filter((x) => x.bytes[0] === 0xb0);
    expect(cc.map((x) => [x.bytes[1], x.bytes[2], +x.atMs.toFixed(3)])).toEqual(pedal.flatMap(([d, u]) => [[64, 127, +(d * mpb).toFixed(3)], [64, 0, +(u * mpb).toFixed(3)]]));
  });
});
