import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type Chart, validateTake } from '../../../../contracts';
import { judgeTake } from '../../../../game/core/judge';
import { curriculum } from '../curriculum';
import { colourOf, replay } from '../engine';
import {
  buildCohort,
  COHORT_SIZE,
  isSyntheticId,
  songSkill,
  pathOf,
  SIM_STEPS,
  syntheticLearner,
  type SyntheticLearner,
  syntheticTakes,
  toLearnerGoalsRow,
  toLearningAttemptRows,
} from '.';

let cohort: readonly SyntheticLearner[];
const fetchSpy = vi.fn();
beforeAll(() => {
  vi.stubGlobal('fetch', fetchSpy);
  cohort = buildCohort();
}, 60_000);
afterAll(() => vi.unstubAllGlobals());

const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

describe('the synthetic cohort', () => {
  it('is exactly 200 learners, synthetic-001 to synthetic-200, built without the network', () => {
    expect(cohort).toHaveLength(COHORT_SIZE);
    expect(COHORT_SIZE).toBe(200);
    expect(cohort.map(l => l.id)).toEqual(Array.from({ length: 200 }, (_, i) => `synthetic-${String(i + 1).padStart(3, '0')}`));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gives the same learners for the same seed, one at a time or all together', () => {
    for (const learner of cohort.filter((_, i) => i % 10 === 0)) expect(syntheticLearner(learner.id)).toEqual(learner);
    expect(syntheticLearner(cohort[41].id)).toBe(syntheticLearner(cohort[41].id));
  });

  it('starts from different conditions', () => {
    expect(new Set(cohort.map(l => l.startingLevel)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(cohort.map(l => l.input))).toEqual(new Set(['midi', 'keyboard']));
    expect(new Set(cohort.map(l => l.goals.songIds.join())).size).toBeGreaterThan(100);
    const songs = new Set(curriculum.songs.map(s => s.songId));
    for (const l of cohort) {
      expect(l.goals.songIds.length).toBeLessThanOrEqual(3);
      for (const id of l.goals.songIds) expect(songs.has(id)).toBe(true);
    }
    expect(cohort.some(l => l.leftDiagnosticEarly)).toBe(true);
    expect(cohort.some(l => !l.leftDiagnosticEarly)).toBe(true);
  });

  it('runs the diagnostic first, then the decided activities, all as this learner', () => {
    for (const l of cohort) {
      expect(l.attempts.every(a => a.learnerId === l.id)).toBe(true);
      const firstActivity = l.attempts.findIndex(a => a.mode === 'activity');
      expect(l.attempts.slice(0, firstActivity).every(a => a.mode === 'diagnostic')).toBe(true);
      expect(l.attempts.slice(firstActivity).every(a => a.mode === 'activity')).toBe(true);
      expect(l.attempts.filter(a => a.mode === 'diagnostic')).toHaveLength(l.diagnosticAnswers);
      expect(l.steps.length).toBeLessThanOrEqual(SIM_STEPS);
      // Laptop keys never count as playing evidence, so a keyboard learner has no takes at all.
      if (l.input === 'keyboard') expect(l.attempts.every(a => a.kind === 'theory')).toBe(true);
    }
  });

  it('agrees with the engine on what each learner mastered', () => {
    for (const l of cohort.slice(0, 20)) {
      const colours = [...replay(curriculum, l.attempts).values()].map(colourOf);
      expect(colours.filter(c => c === 'mastered')).toHaveLength(l.mastered);
    }
  });

  it('takes different paths through the same engine', () => {
    // The fallback breaks score ties by node id, so many learners open on the same backbone node: the opening
    // three steps converge more than the whole run does.
    expect(new Set(cohort.map(l => pathOf(l))).size).toBeGreaterThanOrEqual(10);
    expect(new Set(cohort.map(l => pathOf(l, SIM_STEPS))).size).toBeGreaterThanOrEqual(50);
  });

  it('masters more where the learner knew more', () => {
    const sorted = [...cohort].sort((a, b) => a.hiddenMastery - b.hiddenMastery);
    const quarter = COHORT_SIZE / 4;
    const low = mean(sorted.slice(0, quarter).map(l => l.mastered));
    const high = mean(sorted.slice(-quarter).map(l => l.mastered));
    expect(high).toBeGreaterThan(low);
  });
});

describe('isSyntheticId', () => {
  it('names only synthetic-001 to synthetic-200', () => {
    expect(['synthetic-001', 'synthetic-042', 'synthetic-200'].every(isSyntheticId)).toBe(true);
    for (const id of ['synthetic-000', 'synthetic-201', 'synthetic-42', 'synthetic-0042', 'device', '', ' synthetic-001']) {
      expect(isSyntheticId(id)).toBe(false);
      expect(syntheticLearner(id)).toBeNull();
    }
  });
});

describe('toLearningAttemptRows', () => {
  it('gives each learner its own stable player uuid', () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const l of cohort) expect(l.playerId).toMatch(uuid);
    expect(new Set(cohort.map(l => l.playerId)).size).toBe(COHORT_SIZE);
  });

  it('maps every attempt to a learning_attempts row, oldest first, marked synthetic, ids left to the loader', () => {
    const learner = cohort[7];
    const rows = toLearningAttemptRows(learner, learner.attempts);
    expect(rows).toHaveLength(learner.attempts.length);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ['cold', 'correct', 'created_at', 'details', 'help_share', 'item_id', 'kind', 'mode', 'node_id', 'revealed'],
    );
    const a = learner.attempts[0];
    expect(rows[0]).toMatchObject({ created_at: a.at, item_id: a.itemId, node_id: a.nodeId, help_share: a.helpShare, mode: 'diagnostic' });
    for (const [i, r] of rows.entries()) {
      expect(r.details.synthetic).toBe(true);
      expect(r.item_id.length).toBeGreaterThanOrEqual(1);
      expect(r.item_id.length).toBeLessThanOrEqual(128);
      expect(r.node_id.length).toBeLessThanOrEqual(128);
      expect(r.help_share).toBeGreaterThanOrEqual(0);
      expect(r.help_share).toBeLessThanOrEqual(1);
      expect(JSON.stringify(r.details).length).toBeLessThan(8192);
      expect(new Date(r.created_at).toISOString()).toBe(r.created_at);
      if (i) expect(Date.parse(r.created_at)).toBeGreaterThanOrEqual(Date.parse(rows[i - 1].created_at));
    }
  });

  it('spreads a learner\'s rows over sittings, closer together for learners who come more often', () => {
    const span = (l: SyntheticLearner) => Date.parse(l.attempts.at(-1)!.at) - Date.parse(l.attempts[0].at);
    const rare = cohort.filter(l => l.sessionsPerWeek <= 2 && l.steps.length === SIM_STEPS).map(span);
    const often = cohort.filter(l => l.sessionsPerWeek >= 5 && l.steps.length === SIM_STEPS).map(span);
    expect(mean(rare)).toBeGreaterThan(mean(often));
  });
});

describe('toLearnerGoalsRow', () => {
  it('is the learner\'s goal songs, at most three real song ids', () => {
    const songs = new Set(curriculum.songs.map(s => s.songId));
    for (const l of cohort) {
      const row = toLearnerGoalsRow(l);
      expect(Object.keys(row)).toEqual(['song_ids']);
      expect(row.song_ids).toEqual([...l.goals.songIds]);
      expect(row.song_ids.length).toBeLessThanOrEqual(3);
      expect(row.song_ids.every(id => songs.has(id))).toBe(true);
    }
  });
});

describe('syntheticTakes', () => {
  const chart = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../../../public/songs/${id}/chart.json`, import.meta.url), 'utf8'));

  it('plays a song through the game\'s own judge, the same way every time, before today', () => {
    const learner = cohort.find(l => l.goals.songIds.length > 0)!;
    const song = chart(learner.goals.songIds[0]);
    const takes = syntheticTakes(learner, song);
    expect(takes.length).toBeGreaterThanOrEqual(1);
    expect(syntheticTakes(learner, song)).toEqual(takes);
    for (const { take, results } of takes) {
      expect(validateTake(take)).toEqual([]);
      expect(take.inputDevice).toBe(learner.input === 'keyboard' ? 'keys' : 'midi');
      expect(results).toEqual(judgeTake(song, take));
      expect(Date.parse(take.startedAt)).toBeLessThan(Date.parse('2026-10-25T00:00:00Z'));
    }
    expect(takes.map(t => t.take.startedAt)).toEqual(takes.map(t => t.take.startedAt).sort());
  });

  it('scores higher for learners who know more of what the song needs', () => {
    const song = chart('twinkle');
    const sorted = [...cohort].sort((a, b) => songSkill(a, 'twinkle') - songSkill(b, 'twinkle'));
    const accuracy = (ls: readonly SyntheticLearner[]) => mean(ls.flatMap(l => syntheticTakes(l, song).map(t => t.results.accuracy)));
    expect(accuracy(sorted.slice(-40))).toBeGreaterThan(accuracy(sorted.slice(0, 40)));
  });
});
