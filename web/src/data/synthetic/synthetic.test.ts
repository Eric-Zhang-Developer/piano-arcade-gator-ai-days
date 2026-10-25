// The synthetic learners' takes: deterministic, inside every table CHECK, shaped so each /progress panel has
// something to show, different per starting level, and the switch's roster.json in step with the generator.
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildCohort, type SyntheticLearner } from "../../learn/frontend/mastery/sim";
import { curriculumCharts } from "./charts";
import { SPAN_DAYS, synthesize, type SyntheticRows } from "./generate";
import { ROSTER, rosterEntry } from "./roster";

const sources = curriculumCharts(path.resolve(import.meta.dirname, "../../.."));
const now = new Date("2026-10-25T20:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
let cohort: { learner: SyntheticLearner; rows: SyntheticRows }[] = [];

beforeAll(() => {
  cohort = buildCohort().map((learner) => ({ learner, rows: synthesize(learner, sources, now) }));
}, 60_000);

const takes = () => cohort.flatMap(({ rows }) => rows.takes);
const learner = (id: string) => cohort.find((c) => c.learner.id === id)!;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("synthetic takes", () => {
  it("are the same for the same learner and now; a later now moves the same takes forward", () => {
    const { learner: l, rows } = learner("synthetic-042");
    expect(synthesize(l, sources, now)).toEqual(rows);
    const later = synthesize(l, sources, new Date(now.getTime() + DAY_MS));
    expect(later.takes.map((t) => [t.take.id, t.take.accuracy, t.notes])).toEqual(rows.takes.map((t) => [t.take.id, t.take.accuracy, t.notes]));
    expect(Date.parse(later.takes[0].take.created_at!) - Date.parse(rows.takes[0].take.created_at!)).toBe(DAY_MS);
  });

  it("pass every CHECK on players, songs, takes and note_judgments", () => {
    for (const { rows } of cohort) expect(rows.handle).toMatch(/^[A-Za-z0-9_ ]{1,16}$/);
    for (const s of cohort.flatMap(({ rows }) => rows.songs)) {
      expect(s.id).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(s.beats_per_bar > 0 && s.beats_per_bar <= 32 && s.bpm > 0 && s.note_count > 0).toBe(true);
    }
    const ids = new Set<string>();
    for (const { take: t, notes } of takes()) {
      ids.add(t.id);
      expect(["midi", "keys"]).toContain(t.input_device);
      expect(Math.abs(t.latency_offset_ms)).toBeLessThanOrEqual(150);
      expect(t.bar_from === null).toBe(t.bar_to === null);
      if (t.bar_from !== null) expect(1 <= t.bar_from && t.bar_from <= t.bar_to!).toBe(true);
      expect(t.tempo_pct >= 25 && t.tempo_pct <= 200).toBe(true);
      expect([t.perfect, t.great, t.good, t.miss, t.extras, t.wrong, t.max_combo].every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
      expect(t.accuracy >= 0 && t.accuracy <= 1).toBe(true);
      expect(t.rank).toMatch(/^[A-Z][A-Z+-]{0,2}$/);
      expect(t.take.events.length).toBeGreaterThan(0);
      expect(Date.parse(t.created_at!)).toBeLessThan(now.getTime());
      expect(notes.length).toBe(t.perfect + t.great + t.good + t.miss);
      for (const n of notes) {
        expect(n.take_id).toBe(t.id);
        expect(n.pitch >= 21 && n.pitch <= 108 && ["R", "L"].includes(n.hand) && n.bar >= 1).toBe(true);
        expect(n.judgment).toMatch(/^[A-Z][A-Z_]{0,15}$/);
        expect(n.offset_ms === null).toBe(n.judgment === "MISS");
        if (n.offset_ms !== null) expect(Math.abs(n.offset_ms)).toBeLessThanOrEqual(1000);
        if (n.velocity !== null) expect(n.velocity >= 1 && n.velocity <= 127).toBe(true);
        if (t.bar_from !== null) expect(n.bar >= t.bar_from && n.bar <= t.bar_to!).toBe(true);
      }
    }
    expect(ids.size).toBe(takes().length);
  });

  it("give every panel something: 12 weeks, active and lapsed learners, drills, both inputs, songs played twice", () => {
    expect(cohort).toHaveLength(200);
    const ages = takes().map((t) => (now.getTime() - Date.parse(t.take.created_at!)) / DAY_MS);
    expect(Math.max(...ages)).toBeLessThanOrEqual(SPAN_DAYS + 1);
    expect(Math.max(...ages)).toBeGreaterThan(60);
    const lastAge = cohort.map(({ rows }) => (now.getTime() - Date.parse(rows.takes.at(-1)!.take.created_at!)) / DAY_MS);
    expect(lastAge.filter((d) => d < 2).length).toBeGreaterThan(40);
    expect(lastAge.filter((d) => d > 6).length).toBeGreaterThan(40);
    expect(takes().filter((t) => t.take.bar_from !== null).length).toBeGreaterThan(200);
    expect(new Set(takes().map((t) => t.take.input_device))).toEqual(new Set(["midi", "keys"]));
    for (const { rows } of cohort) {
      const perSong = Map.groupBy(rows.takes, (t) => t.take.song_id);
      expect([...perSong.values()].filter((ts) => ts.length >= 2).length).toBeGreaterThan(0);
    }
    const counts = cohort.map(({ rows }) => rows.takes.length);
    expect(Math.min(...counts)).toBeLessThan(8);
    expect(Math.max(...counts)).toBeGreaterThan(24);
    expect(takes().reduce((a, t) => a + t.notes.length, 0)).toBeLessThanOrEqual(250_000);
  });

  it("differ by starting level: two learners, and the levels on average", () => {
    const beginner = learner("synthetic-003");
    const advanced = learner("synthetic-042");
    expect(beginner.learner.startingLevel).not.toBe(advanced.learner.startingLevel);
    const accuracy = (rows: SyntheticRows) => mean(rows.takes.map((t) => t.take.accuracy));
    expect(accuracy(advanced.rows) - accuracy(beginner.rows)).toBeGreaterThan(0.2);
    expect(advanced.rows.takes.length).not.toBe(beginner.rows.takes.length);
    const levelMean = (level: string) => mean(cohort.filter((c) => c.learner.startingLevel === level).map((c) => accuracy(c.rows)));
    expect(levelMean("Advanced") - levelMean("New to music")).toBeGreaterThan(0.2);
  });
});

describe("roster.json", () => {
  it("is what the generator makes: rerun `node src/data/synthetic/run.mjs --roster` after changing it", () => {
    expect(ROSTER).toEqual(cohort.map(({ learner, rows }) => rosterEntry(learner, rows, sources)));
  });
});
