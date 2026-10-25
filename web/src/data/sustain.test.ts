import { afterEach, expect, test, vi } from "vitest";
import type { Chart, InputEvent, Take } from "../contracts";
import { judgeTake } from "../game/core/judge";
import { createSavePlugin } from "./save-plugin";
import { takeRows } from "./mapping";
import { enqueue, readOutbox } from "./outbox";

const chart: Chart = { id: "hold", title: "Hold", composer: "fixture", source: "fixture", bpm: 120, beatsPerBar: 4, notes: [{ id: "n", pitch: 60, beat: 0, duration: 2, hand: "R" }] };
const ids = { takeId: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", chartSha256: "f".repeat(64) };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test.each([[false, 2], [true, 2], [false, 3], [true, 3]] as const)("save recording preserves frozen-clock release evidence; released=%s policy=%s", async (releasedInPause, version) => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("localStorage", { getItem: () => null });
  const saved: Take[] = [];
  const plugin = createSavePlugin((_id, take) => saved.push(take), async () => chart);
  plugin.transformChart!(chart, new URLSearchParams(`scoring=${version}`));
  let fire: (e: InputEvent) => void = () => {};
  plugin.wrapInput!({ kind: "midi", start(cb) { fire = cb; }, stop() {} }).start(() => {});
  plugin.onEvent!({ type: "songStart", atMs: 0 });
  fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1000 });
  now = 1400; plugin.onEvent!({ type: "pause", atMs: 400 });
  fire({ type: "on", pitch: 64, velocity: 80, timeMs: 2000 }); // menu key, not performance
  if (releasedInPause) fire({ type: "off", pitch: 60, velocity: 0, timeMs: 3000 });
  now = 6400; plugin.onEvent!({ type: "resume", atMs: 400 });
  if (!releasedInPause) fire({ type: "off", pitch: 60, velocity: 0, timeMs: 7000 });
  plugin.onEvent!({ type: "songEnd", atMs: 1200, results: {} as never });
  await vi.waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0].scoringVersion).toBe(version);
  expect(saved[0].events).toEqual([{ pitch: 60, velocity: 80, timeMs: 0, offTimeMs: releasedInPause ? 400 : 1000 }]);
  const result = judgeTake(chart, saved[0]);
  expect(result.sustain!.earnedPoints).toBe(releasedInPause ? 40 : 100);
  const row = takeRows(ids, chart, saved[0], result).take;
  expect([row.judge_version, row.contract_version]).toEqual([version, version]);
  expect(row.take.scoringVersion).toBe(version);
  expect(row.results.sustain).toEqual(result.sustain);
});

test("legacy outbox and row policy remain intact beside version2", () => {
  const legacy: Take = { chartId: chart.id, startedAt: "2026-10-24T00:00:00Z", inputDevice: "midi", latencyOffsetMs: 0, events: [{ pitch: 60, velocity: 80, timeMs: 0, offTimeMs: null }] };
  const memory = new Map<string, string>();
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) };
  enqueue(storage, "old", legacy);
  enqueue(storage, "new", { ...legacy, scoringVersion: 2 });
  expect(readOutbox(storage).map(i => i.take)).toEqual([legacy, { ...legacy, scoringVersion: 2 }]);
  const row = takeRows(ids, chart, legacy, judgeTake(chart, legacy)).take;
  expect([row.judge_version, row.contract_version]).toEqual([1, 1]);
  expect(row.results.sustain).toBeUndefined();
});

test("matched phase timestamps survive delayed plugin dispatch without shifting saved notes", async () => {
  vi.spyOn(performance, "now").mockReturnValue(1120); // another plugin spent120ms initializing audio
  vi.stubGlobal("localStorage", { getItem: () => null });
  const saved: Take[] = [];
  const plugin = createSavePlugin((_id, take) => saved.push(take), async () => chart);
  plugin.transformChart!(chart, new URLSearchParams("scoring=2"));
  let fire: (e: InputEvent) => void = () => {};
  plugin.wrapInput!({ kind: "midi", start(cb) { fire = cb; }, stop() {} }).start(() => {});
  plugin.onEvent!({ type: "songStart", atMs: 0, performanceMs: 1000 });
  fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1000 });
  fire({ type: "off", pitch: 60, velocity: 0, timeMs: 2000 });
  plugin.onEvent!({ type: "songEnd", atMs: 1200, results: {} as never });
  await vi.waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0].events[0]).toMatchObject({ timeMs: 0, offTimeMs: 1000 });
  expect(judgeTake(chart, saved[0]).sustain!.earnedPoints).toBe(100);
});

test("disconnect remains unknown after a late release and later retrigger", async () => {
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.stubGlobal("localStorage", { getItem: () => null });
  const repeated = { ...chart, notes: [...chart.notes, { ...chart.notes[0], id: "second", beat: 2 }] };
  const saved: Take[] = [];
  const plugin = createSavePlugin((_id, take) => saved.push(take), async () => repeated);
  plugin.transformChart!(repeated, new URLSearchParams());
  let fire: (e: InputEvent) => void = () => {};
  plugin.wrapInput!({ kind: "midi", start(cb) { fire = cb; }, stop() {} }).start(() => {});
  plugin.onEvent!({ type: "songStart", atMs: 0, performanceMs: 1000 });
  fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1000 });
  fire({ type: "off", pitch: 60, velocity: 0, timeMs: 1400, cancelled: true });
  fire({ type: "off", pitch: 60, velocity: 0, timeMs: 1600 });
  fire({ type: "on", pitch: 60, velocity: 80, timeMs: 2000 });
  fire({ type: "off", pitch: 60, velocity: 0, timeMs: 3000 });
  plugin.onEvent!({ type: "songEnd", atMs: 2200, results: {} as never });
  await vi.waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0].events.map(e => e.offTimeMs)).toEqual([null, 2000]);
  expect(judgeTake(repeated, saved[0]).sustain!.notes.map(n => n.earnedPoints)).toEqual([0, 100]);
});

test.each([[false, 2000], [true, 400]] as const)("a confirmed hold still down at songEnd closes at the finish cutoff; paused=%s", async (paused, off) => {
  let now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("localStorage", { getItem: () => null });
  const saved: Take[] = [];
  const plugin = createSavePlugin((_id, take) => saved.push(take), async () => chart);
  plugin.transformChart!(chart, new URLSearchParams("scoring=3"));
  let fire: (e: InputEvent) => void = () => {};
  plugin.wrapInput!({ kind: "midi", start(cb) { fire = cb; }, stop() {} }).start(() => {});
  plugin.onEvent!({ type: "songStart", atMs: 0, performanceMs: 1000 });
  fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1000 });
  fire({ type: "on", pitch: 62, velocity: 80, timeMs: 1100 });
  fire({ type: "off", pitch: 62, velocity: 0, timeMs: 1200, cancelled: true });
  if (paused) { now = 1400; plugin.onEvent!({ type: "pause", atMs: 400 }); }
  plugin.onEvent!({ type: "songEnd", atMs: 2000, results: {} as never });
  await vi.waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0].events.map(e => e.offTimeMs)).toEqual([off, null]);
  expect(judgeTake(chart, saved[0]).sustain!.earnedPoints).toBe(paused ? 40 : 100);
});
