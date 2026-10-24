import { afterEach, describe, expect, it, test, vi } from "vitest";
import type { Chart, InputEvent, Results, ResultsPanelContext, Take } from "../../contracts";
import { getReplayState, pianoOut, pianoOutSettings, replayMessages } from "./index";

const take = (events: Take["events"]): Take => ({ chartId: "t", startedAt: "2026-10-24T00:00:00Z", latencyOffsetMs: 0, inputDevice: "midi", events });
const notesOff = (atMs: number) => [...Array(16).keys()].map((ch) => ({ bytes: [0xb0 + ch, 123, 0], atMs }));

test("a take becomes Local off, its notes with real gaps and velocities, then All Notes Off and Local on", () => {
  const { leadMs } = pianoOutSettings; // 200
  const msgs = replayMessages(
    take([
      { pitch: 60, velocity: 30, timeMs: 400, offTimeMs: 450 }, // re-pressed as 60 releases, listed first
      { pitch: 60, velocity: 64, timeMs: -50, offTimeMs: 400 },
      { pitch: 64, velocity: 100, timeMs: 600, offTimeMs: 900 },
    ]),
    1000,
  );
  const s = 1000 + leadMs; // the first press, at -50, lands here
  expect(msgs).toEqual([
    { bytes: [0xb0, 122, 0], atMs: 1000 },
    { bytes: [0x90, 60, 64], atMs: s },
    { bytes: [0x80, 60, 0], atMs: s + 450 },
    { bytes: [0x90, 60, 30], atMs: s + 450 },
    { bytes: [0x80, 60, 0], atMs: s + 500 },
    { bytes: [0x90, 64, 100], atMs: s + 650 },
    { bytes: [0x80, 64, 0], atMs: s + 950 },
    ...notesOff(s + 950),
    { bytes: [0xb0, 122, 127], atMs: s + 950 },
  ]);
});

test("a press with no release is held for heldMs; an empty take only toggles Local Control and clears notes", () => {
  const msgs = replayMessages(take([{ pitch: 72, velocity: 80, timeMs: 0, offTimeMs: null }]), 0);
  expect(msgs[2]).toEqual({ bytes: [0x80, 72, 0], atMs: pianoOutSettings.leadMs + pianoOutSettings.heldMs });
  expect(replayMessages(take([]), 5)).toEqual([{ bytes: [0xb0, 122, 0], atMs: 5 }, ...notesOff(5), { bytes: [0xb0, 122, 127], atMs: 5 }]);
});

describe("the plugin (play-slots)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function playTake(outputs: { name: string }[]) {
    vi.stubGlobal("window", { addEventListener() {} });
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map(outputs.map((o, i) => [String(i), o])) }) });
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const p = pianoOut();
    p.transformChart!({ id: "t" } as Chart, new URLSearchParams());
    await new Promise((r) => setTimeout(r, 0)); // MIDI access resolves
    let key: (e: InputEvent) => void = () => {};
    const device = p.wrapInput!({ kind: "keys", start: (cb) => void (key = cb), stop() {} });
    await device.start(() => {});
    const on = (pitch: number, timeMs: number) => key({ type: "on", pitch, velocity: 80, timeMs });
    p.onEvent!({ type: "songStart", atMs: 0 });
    on(60, 1100);
    now = 1200;
    p.onEvent!({ type: "pause", atMs: 200 });
    on(62, 1500); // in the pause menu
    now = 6200;
    p.onEvent!({ type: "resume", atMs: 200 });
    on(64, 6300);
    p.onEvent!({ type: "songEnd", atMs: 300, results: {} as Results });
    return p;
  }

  it("records no keys while paused, and the replay skips the pause", async () => {
    await playTake([{ name: "Digital Piano-1 Portable Grand" }]);
    expect(getReplayState().take!.events.map((e) => [e.pitch, e.timeMs])).toEqual([
      [60, 100],
      [64, 300],
    ]);
  });

  it("shows Replay on piano in its results panel only when there's a piano", async () => {
    const ctx = {} as ResultsPanelContext;
    expect((await playTake([{ name: "Digital Piano-1 Portable Grand" }])).resultsPanel!(ctx)).not.toBeNull();
    expect((await playTake([])).resultsPanel!(ctx)).toBeNull();
  });
});
