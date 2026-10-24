import { expect, test, vi } from "vitest";
import type { GameEvent, Results } from "../../contracts";
import { eventSounds, soundSettings, soundsFor } from "./index";

const results = {} as Results;
const events: GameEvent[] = [
  { type: "songStart", atMs: -4800 },
  { type: "countInBeat", beat: 1, atMs: -4800 },
  { type: "noteHit", noteId: "n1", pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: 0 },
  { type: "combo", count: 1, atMs: 0 },
  { type: "noteMiss", noteId: "n2", pitch: 60, atMs: 700 },
  { type: "comboMilestone", count: 25, atMs: 15000 },
  { type: "feverStart", atMs: 18000 },
  { type: "feverEnd", atMs: 19000 },
  { type: "extra", pitch: 61, atMs: 19500 },
  { type: "wrongNote", pitch: 61, atMs: 19500 },
  { type: "fullCombo", atMs: 29000 },
  { type: "songEnd", results, atMs: 29000 },
];

test("events map to sounds on the audio clock, exactly", () => {
  const { rankHitMs, fanfareAfterHitMs } = soundSettings;
  expect(soundsFor(events, 10)).toEqual([
    { sound: "miss", startTime: 10.7 },
    { sound: "stinger", startTime: 25 },
    { sound: "sweep", startTime: 28 },
    { sound: "fanfare", startTime: 10 + (29000 + rankHitMs + fanfareAfterHitMs) / 1000 },
    { sound: "drumroll", startTime: 39 },
    { sound: "rankHit", startTime: 10 + (29000 + rankHitMs) / 1000 },
  ]);
});

test("the miss cue can be turned off; hits, combos, extras and the count-in make no sound", () => {
  expect(soundsFor(events, 0, false).map((s) => s.sound)).toEqual(["stinger", "sweep", "fanfare", "drumroll", "rankHit"]);
});

test("wait mode: songEnd schedules no drumroll or rank hit", () => {
  // A fake Web Audio: every node is a proxy, and each start() is a scheduled sound.
  let starts = 0;
  const node = (): unknown =>
    new Proxy(() => {}, {
      get: (_, k) => (k === "start" ? () => starts++ : k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : node()),
      apply: () => node(),
      set: () => true,
    });
  vi.stubGlobal("AudioContext", function () {
    return node();
  });
  const ending = (params: string) => {
    const p = eventSounds();
    p.transformChart!({} as never, new URLSearchParams(params));
    p.onEvent!({ type: "songStart", atMs: 0 });
    starts = 0;
    p.onEvent!({ type: "songEnd", results: {} as Results, atMs: 5000 });
    return starts;
  };
  expect(ending("")).toBeGreaterThan(0);
  expect(ending("mode=wait")).toBe(0);
  vi.unstubAllGlobals();
});
