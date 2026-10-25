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
    // One expect at the end: an expect per note is millions of calls, too slow for CI.
    const bad: string[] = [];
    const check = (ok: boolean, what: string) => ok || bad.push(what);
    for (const { rows } of cohort) check(/^[A-Za-z0-9_ ]{1,16}$/.test(rows.handle), `handle ${rows.handle}`);
    for (const s of cohort.flatMap(({ rows }) => rows.songs))
      check(/^[a-z0-9-]{1,64}$/.test(s.id) && s.beats_per_bar > 0 && s.beats_per_bar <= 32 && s.bpm > 0 && s.note_count > 0, `song ${s.id}`);
    const ids = new Set<string>();
    for (const { take: t, notes } of takes()) {
      ids.add(t.id);
      check(t.input_device === "midi" || t.input_device === "keys", `${t.id} input_device`);
      check(Math.abs(t.latency_offset_ms) <= 150, `${t.id} latency_offset_ms`);
      check(t.bar_from === null ? t.bar_to === null : t.bar_to !== null && 1 <= t.bar_from && t.bar_from <= t.bar_to, `${t.id} bars`);
      check(t.tempo_pct >= 25 && t.tempo_pct <= 200, `${t.id} tempo_pct`);
      check([t.perfect, t.great, t.good, t.miss, t.extras, t.wrong, t.max_combo].every((n) => Number.isInteger(n) && n >= 0), `${t.id} counts`);
      check(t.accuracy >= 0 && t.accuracy <= 1, `${t.id} accuracy`);
      check(/^[A-Z][A-Z+-]{0,2}$/.test(t.rank), `${t.id} rank`);
      check(t.take.events.length > 0, `${t.id} no events`);
      check(Date.parse(t.created_at!) < now.getTime(), `${t.id} in the future`);
      check(notes.length === t.perfect + t.great + t.good + t.miss, `${t.id} note count`);
      for (const n of notes) {
        const where = `${t.id} ${n.note_id}`;
        check(n.take_id === t.id && n.pitch >= 21 && n.pitch <= 108 && (n.hand === "R" || n.hand === "L") && n.bar >= 1, `${where} shape`);
        check(/^[A-Z][A-Z_]{0,15}$/.test(n.judgment), `${where} judgment`);
        check((n.offset_ms === null) === (n.judgment === "MISS") && (n.offset_ms === null || Math.abs(n.offset_ms) <= 1000), `${where} offset`);
        check(n.velocity === null || (n.velocity >= 1 && n.velocity <= 127), `${where} velocity`);
        check(t.bar_from === null || (n.bar >= t.bar_from && n.bar <= t.bar_to!), `${where} outside the drill`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
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
