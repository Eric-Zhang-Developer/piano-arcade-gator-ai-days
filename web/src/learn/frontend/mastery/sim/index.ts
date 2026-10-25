import { curriculum } from '../curriculum';
import { simulateLearner, syntheticId, type SyntheticLearner } from './learner';
import { COHORT_SEED, COHORT_SIZE } from './params';
import { mix } from './random';

// 200 seeded synthetic learners, not real students: the same seed always gives the same cohort, nothing is stored.
export { COHORT_SEED, COHORT_SIZE, SIM_STEPS } from './params';
export { type SimStep, type SyntheticLearner } from './learner';
export { type LearningAttemptRow, toLearnerGoalsRow, toLearningAttemptRows } from './rows';
export { songSkill, syntheticTakes } from './songs';

const ID = /^synthetic-(\d{3})$/;

/** The index (1-200) a synthetic id names, or null. */
function indexOf(id: string): number | null {
  const match = ID.exec(id);
  const index = match ? Number(match[1]) : 0;
  return index >= 1 && index <= COHORT_SIZE ? index : null;
}

/** Whether the id is one of `synthetic-001` to `synthetic-200`. */
export const isSyntheticId = (id: string): boolean => indexOf(id) !== null;

/** Each learner draws from its own seed, so one can be built without the other 199. */
const learnerSeed = (seed: number, index: number) => mix(seed, index);

/** The whole cohort, in id order. */
export function buildCohort(seed = COHORT_SEED): readonly SyntheticLearner[] {
  return Array.from({ length: COHORT_SIZE }, (_, i) => simulateLearner(curriculum, learnerSeed(seed, i + 1), i + 1));
}

const built = new Map<string, SyntheticLearner>();

/** One learner of the default cohort, built on first use and kept; null for an id outside it. */
export function syntheticLearner(id: string): SyntheticLearner | null {
  const index = indexOf(id);
  if (index === null) return null;
  let learner = built.get(id);
  if (!learner) {
    learner = simulateLearner(curriculum, learnerSeed(COHORT_SEED, index), index);
    built.set(syntheticId(index), learner);
  }
  return learner;
}

/** A learner's first `count` decided steps as one key, to count how many different paths the cohort takes. */
export const pathOf = (learner: SyntheticLearner, count = 3) =>
  learner.steps.slice(0, count).map(s => `${s.activity}:${s.nodeId}`).join(' > ');
