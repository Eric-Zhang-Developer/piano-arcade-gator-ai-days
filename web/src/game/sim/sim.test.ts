// Core-loop's real MIDI input (midiDevice) and judge, driven through the fake piano.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart, InputEvent } from "../../contracts";
import { midiDevice } from "../core/input";
import { Judge } from "../core/judge";
import { botTimeline } from "./bot";
import { createSimMidiAccess, keyOff, keyOn, type SimProfile } from "./fake";
import fixture from "./fixtures/python-piano.json";

const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// The game's MIDI device, connected to a fresh fake piano.
async function connect(profile: Partial<SimProfile> = {}) {
  const sim = createSimMidiAccess(profile);
  vi.stubGlobal("navigator", { requestMIDIAccess: async () => sim.access });
  const events: InputEvent[] = [];
  const status: string[] = [];
  await midiDevice((s) => status.push(s)).start((e) => events.push(e));
  return { sim, events, status };
}

describe("the game's MIDI input through the fake piano", () => {
  it("the Perfect player's Twinkle take, as raw bytes, judges all PERFECT", async () => {
    const { sim, events } = await connect();
    const zeroPerf = performance.now() + 1000;
    sim.play(botTimeline(chart), zeroPerf);
    await vi.runAllTimersAsync();

    const judge = new Judge(chart);
    events.filter((e) => e.type === "on").forEach((e, i) => judge.press(e.pitch, e.timeMs - zeroPerf, i));
    const r = judge.finish(1e9);
    expect(r.counts).toMatchObject({ PERFECT: chart.notes.length, GREAT: 0, MISS: 0, extra: 0 }); // later fields (GOOD, wrong) may be added
    expect(events.filter((e) => e.type === "off")).toHaveLength(chart.notes.length);
  });

  it("note-on with velocity 0 is an off event; 0xFE and 0xF8 are no event", async () => {
    const { sim, events } = await connect();
    sim.play([
      { timeMs: 0, bytes: [0xfe] },
      { timeMs: 1, bytes: [0xf8] },
      { timeMs: 2, bytes: keyOff(60) },
    ]);
    await vi.runAllTimersAsync();
    expect(events.map((e) => [e.type, e.pitch, e.velocity])).toEqual([["off", 60, 0]]);
  });

  it("picks Portable Grand even with IAC Driver Bus 1 listed first", async () => {
    const { sim, events, status } = await connect({ extraInputs: ["IAC Driver Bus 1"] });
    expect([...sim.access.inputs.values()].map((p) => p.name)).toEqual(["IAC Driver Bus 1", "Portable Grand"]);
    expect(status).toEqual(["MIDI: Portable Grand"]);
    sim.send(keyOn(60, 64));
    await vi.runAllTimersAsync();
    expect(events).toHaveLength(1);
  });

  it("replaying python-piano.json yields one on event per logged note-on, at the logged times", async () => {
    for (const seg of fixture.segments) {
      const { sim, events } = await connect();
      const t0 = performance.now();
      const first = seg.messages[0].timeMs;
      sim.play(seg.messages.map((m) => ({ timeMs: m.timeMs - first, bytes: m.bytes })), t0);
      await vi.runAllTimersAsync();

      const expected = seg.messages.filter((m) => (m.bytes[0] & 0xf0) === 0x90 && m.bytes[2] > 0);
      const ons = events.filter((e) => e.type === "on");
      expect(ons, seg.label).toHaveLength(expected.length);
      ons.forEach((e, i) => {
        expect(e.pitch).toBe(expected[i].bytes[1]);
        expect(Math.abs(e.timeMs - t0 - (expected[i].timeMs - first))).toBeLessThan(1); // 1 ms timestamp floor
      });
    }
  });
});

describe("faults", () => {
  it("stall(3000): nothing for 3000 ms while the port stays connected", async () => {
    const { sim, events } = await connect();
    const t0 = performance.now();
    sim.stall(3000);
    sim.play([0, 1000, 2999, 3000, 4000].map((timeMs) => ({ timeMs, bytes: keyOn(60, 64) })), t0);
    await vi.advanceTimersByTimeAsync(2999);
    expect(events).toHaveLength(0);
    expect(sim.input.state).toBe("connected");
    await vi.runAllTimersAsync();
    expect(events.map((e) => e.timeMs - t0)).toEqual([3000, 4000]);
  });

  it("unplug() fires statechange with state disconnected; messages stop until replug()", async () => {
    const { sim, events } = await connect();
    const states: string[] = [];
    sim.access.onstatechange = (e) => states.push((e as MIDIConnectionEvent).port!.state);
    sim.unplug();
    expect(states[0]).toBe("disconnected");
    sim.send(keyOn(60, 64));
    await vi.runAllTimersAsync();
    expect(events).toHaveLength(0);
    sim.replug();
    expect(states.at(-1)).toBe("connected");
    sim.send(keyOn(60, 64));
    await vi.runAllTimersAsync();
    expect(events).toHaveLength(1);
  });

  it("dropRelease(pitch): the next release of that pitch never arrives", async () => {
    const { sim, events } = await connect();
    sim.dropRelease(60);
    sim.play([keyOn(60, 64), keyOff(60), keyOn(60, 64), keyOff(60)].map((bytes, i) => ({ timeMs: i * 100, bytes })));
    await vi.runAllTimersAsync();
    expect(events.map((e) => e.type)).toEqual(["on", "on", "off"]);
  });

  it("jitter is seeded, within ±jitterMs, and never reorders", async () => {
    const run = async () => {
      const { sim, events } = await connect({ jitterMs: 10, seed: 7 });
      const t0 = performance.now();
      sim.play(Array.from({ length: 50 }, (_, i) => ({ timeMs: i * 5, bytes: keyOn(60 + (i % 12), 64) })), t0);
      await vi.runAllTimersAsync();
      expect(events.map((e) => e.pitch)).toEqual(Array.from({ length: 50 }, (_, i) => 60 + (i % 12)));
      return events.map((e) => e.timeMs - t0);
    };
    const a = await run();
    expect(await run()).toEqual(a);
    a.forEach((t, i) => {
      expect(Math.abs(t - i * 5)).toBeLessThanOrEqual(10);
      if (i) expect(t).toBeGreaterThanOrEqual(a[i - 1]);
    });
  });

  it("no Active Sensing by default (unmeasured)", async () => {
    const sim = createSimMidiAccess();
    const seen: number[][] = [];
    sim.onLog((l) => l.kind === "message" && seen.push(l.bytes));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sim.profile.activeSensingMs).toBeNull();
    expect(seen).toEqual([]);
  });
});

it("output messages are recorded and never appear on the input", async () => {
  const { sim, events } = await connect();
  const raw: number[][] = [];
  sim.onLog((l) => l.kind === "message" && raw.push(l.bytes));
  sim.output.send([0x99, 36, 100]);
  sim.output.send(keyOn(60, 90), 5);
  await vi.runAllTimersAsync();
  expect(sim.output.sent.map((m) => [...m.data])).toEqual([[0x99, 36, 100], [0x90, 60, 90]]);
  expect(events).toEqual([]);
  expect(raw).toEqual([]);
});
