// The watchdog around core's real MIDI input, driven by piano-sim's fake piano on a fake clock.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart, Frame, InputEvent } from "../../contracts";
import { midiDevice } from "../core/input";
import { createSimMidiAccess, keyOff, keyOn, type SimProfile, type TimelineEntry } from "../sim/fake";
import { DISCONNECTED, midiWatchdog, RECONNECTING } from ".";

const chart: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const SENSING = { activeSensingMs: 300 }; // a test setting: whether the DGX-660's 0xFE reaches Chrome is unmeasured

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function connect(profile: Partial<SimProfile> = {}) {
  const sim = createSimMidiAccess(profile);
  const requestMIDIAccess = vi.fn(async () => sim.access);
  vi.stubGlobal("navigator", { requestMIDIAccess });
  const wd = midiWatchdog();
  const device = wd.wrapInput!(midiDevice(() => {}));
  const events: InputEvent[] = [];
  await device.start((e) => events.push(e));
  const stalls = () => wd.log.filter((l) => l.kind === "stall").length;
  const notice = () => {
    const texts: string[] = [];
    const ctx = { fillText: (t: string) => texts.push(t) } as unknown as CanvasRenderingContext2D;
    wd.draw!(ctx, { judgmentLineY: 500 } as Frame);
    return texts[0] ?? "";
  };
  return { sim, wd, device, events, stalls, notice, requestMIDIAccess };
}

// Keys every 100 ms from t0 to t0 + ms, alternating note-on and release.
const keys = (ms: number): TimelineEntry[] =>
  Array.from({ length: ms / 100 }, (_, i) => ({ timeMs: i * 100, bytes: i % 2 ? keyOff(60 + ((i >> 1) % 12)) : keyOn(60 + ((i >> 1) % 12), 64) }));

describe("with Active Sensing (the 3 s rule)", () => {
  it("messages every 300 ms trigger no reconnect", async () => {
    const { stalls } = await connect(SENSING);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stalls()).toBe(0);
  });

  it("stall(3000) triggers exactly one reconnect, then recovers", async () => {
    const { sim, wd, stalls, notice, requestMIDIAccess } = await connect(SENSING);
    await vi.advanceTimersByTimeAsync(1000);
    const before = requestMIDIAccess.mock.calls.length;
    sim.stall(3000);
    await vi.advanceTimersByTimeAsync(3200);
    expect(stalls()).toBe(1);
    expect(requestMIDIAccess.mock.calls.length).toBeGreaterThan(before); // MIDI access re-requested
    await vi.advanceTimersByTimeAsync(10_000);
    expect(stalls()).toBe(1);
    expect(wd.log.map((l) => l.kind)).toEqual(["stall", "recovered"]);
    expect(notice()).toBe("");
  });

  it("shows the reconnecting notice until a message arrives", async () => {
    const { sim, notice } = await connect(SENSING);
    await vi.advanceTimersByTimeAsync(1000);
    sim.stall(10_000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(notice()).toBe(RECONNECTING);
    await vi.advanceTimersByTimeAsync(8000);
    expect(notice()).toBe("");
  });

  it("no key event is lost or duplicated across the reconnect", async () => {
    const { sim, events, stalls } = await connect(SENSING);
    const t0 = performance.now();
    const timeline = keys(9000);
    sim.play(timeline, t0);
    await vi.advanceTimersByTimeAsync(1000);
    sim.stall(3500); // the fake drops everything after the 1000 ms key until 4500 ms: that loss is the stall itself
    await vi.advanceTimersByTimeAsync(12_000);

    expect(stalls()).toBe(1);
    const sent = timeline.filter((m) => m.timeMs <= 1000 || m.timeMs >= 4500);
    expect(events.map((e) => [e.type, e.pitch, e.timeMs - t0])).toEqual(
      sent.map((m) => [m.bytes[2] ? "on" : "off", m.bytes[1], m.timeMs]),
    );
  });

  it("a reconnect that gets new port objects still delivers each key once", async () => {
    // Chrome may hand back a new MIDIAccess: the old port's handler and the new one both fire.
    const a = createSimMidiAccess(SENSING);
    const b = createSimMidiAccess(SENSING);
    let calls = 0;
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => (calls++ < 2 ? a.access : b.access) });
    const wd = midiWatchdog();
    const device = wd.wrapInput!(midiDevice(() => {}));
    const events: InputEvent[] = [];
    await device.start((e) => events.push(e));
    await vi.advanceTimersByTimeAsync(1000);
    a.stall(5000);
    b.stall(5000);
    await vi.advanceTimersByTimeAsync(3500); // reconnected onto b
    expect(wd.log.filter((l) => l.kind === "stall")).toHaveLength(1);
    const t = performance.now() + 100;
    a.stall(0);
    b.stall(0);
    for (const s of [a, b]) s.play([{ timeMs: 0, bytes: keyOn(64, 70) }], t);
    await vi.advanceTimersByTimeAsync(500);
    expect(events.filter((e) => e.pitch === 64)).toHaveLength(1);
  });
});

describe("unplug", () => {
  it("unplug() shows laptop keys active and stops reconnecting; replug() clears it", async () => {
    const { sim, wd, stalls, notice } = await connect(SENSING);
    await vi.advanceTimersByTimeAsync(1000);
    sim.unplug();
    expect(notice()).toBe(DISCONNECTED);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(stalls()).toBe(0);
    sim.replug();
    await vi.advanceTimersByTimeAsync(1000);
    expect(notice()).toBe("");
    expect(wd.log.map((l) => l.kind)).toEqual(["disconnected", "connected"]);
  });
});

describe("without Active Sensing (the 10 s fallback)", () => {
  it("10 s of no MIDI while notes are due triggers one reconnect", async () => {
    const { wd, stalls } = await connect();
    wd.transformChart!(chart, new URLSearchParams());
    wd.onEvent!({ type: "songStart", atMs: 0 });
    await vi.advanceTimersByTimeAsync(10_200);
    expect(stalls()).toBe(1);
  });

  it("no song playing: silence is a quiet player, not a stall", async () => {
    const { wd, stalls } = await connect();
    wd.transformChart!(chart, new URLSearchParams());
    await vi.advanceTimersByTimeAsync(30_000);
    expect(stalls()).toBe(0);
  });

  it("3 s of silence alone is not a stall before Active Sensing has been seen", async () => {
    const { wd, stalls } = await connect();
    wd.transformChart!(chart, new URLSearchParams());
    wd.onEvent!({ type: "songStart", atMs: 0 });
    await vi.advanceTimersByTimeAsync(9000);
    expect(stalls()).toBe(0);
  });
});
