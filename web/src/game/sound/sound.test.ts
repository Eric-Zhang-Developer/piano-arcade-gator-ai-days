import { expect, test } from "vitest";
import type { GameEvent, Results } from "../../contracts";
import { soundSettings, soundsFor } from "./index";

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
