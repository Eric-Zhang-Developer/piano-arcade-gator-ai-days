import { expect, test } from "vitest";
import type { Take } from "../../contracts";
import { pianoOutSettings, replayMessages } from "./index";

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
