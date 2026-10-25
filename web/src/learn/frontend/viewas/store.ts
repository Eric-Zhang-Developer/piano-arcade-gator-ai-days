import { type AttemptStore, parseAttempt } from '../mastery/engine';
import type { Attempt, Goals } from '../mastery/schema';
import { syntheticLearner } from '../mastery/sim';
import { SYNTHETIC_KEY } from './view-as';

type Kept = Record<string, { attempts: Attempt[]; goals?: Goals }>;

function readKept(): Kept {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(SYNTHETIC_KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const kept: Kept = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const v = (value ?? {}) as Record<string, unknown>;
      const attempts = Array.isArray(v.attempts) ? v.attempts.map(parseAttempt).filter((a): a is Attempt => a !== null) : [];
      const songIds = (v.goals as Record<string, unknown> | undefined)?.songIds;
      const goals = Array.isArray(songIds) && songIds.every(s => typeof s === 'string') ? { songIds } : undefined;
      kept[id] = { attempts, ...(goals ? { goals } : {}) };
    }
    return kept;
  } catch {
    return {};
  }
}

function write(kept: Kept): boolean {
  try {
    sessionStorage.setItem(SYNTHETIC_KEY, JSON.stringify(kept));
    return true;
  } catch {
    return false;
  }
}

const byTime = (a: Attempt, b: Attempt) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id);

/**
 * A synthetic learner's attempts and goals: the simulated history, plus what this tab appended while viewing as
 * them, kept in `sessionStorage`. Nothing here reaches Supabase or the device's own learner.
 */
export const syntheticStore: AttemptStore = {
  async append(attempt) {
    const learner = syntheticLearner(attempt.learnerId);
    if (!learner) return false;
    const kept = readKept();
    const mine = kept[attempt.learnerId] ?? { attempts: [] };
    if ([...learner.attempts, ...mine.attempts].some(a => a.id === attempt.id)) return true;
    return write({ ...kept, [attempt.learnerId]: { ...mine, attempts: [...mine.attempts, attempt] } });
  },
  async list(learnerId) {
    const learner = syntheticLearner(learnerId);
    if (!learner) return [];
    return [...learner.attempts, ...(readKept()[learnerId]?.attempts ?? [])].sort(byTime);
  },
  async getGoals(learnerId) {
    return readKept()[learnerId]?.goals ?? syntheticLearner(learnerId)?.goals ?? { songIds: [] };
  },
  async setGoals(learnerId, goals) {
    if (!syntheticLearner(learnerId)) return false;
    const kept = readKept();
    return write({ ...kept, [learnerId]: { attempts: kept[learnerId]?.attempts ?? [], goals: { songIds: [...goals.songIds] } } });
  },
};
