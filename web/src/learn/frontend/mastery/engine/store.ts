import type { Attempt, Goals } from '../schema';

/**
 * Where attempts and goals live. Attempts are appended and never changed; every node state is replayed from them.
 * Writes resolve to false when the store refused them, so the caller can say so instead of losing work silently.
 */
export interface AttemptStore {
  append(attempt: Attempt): Promise<boolean>;
  list(learnerId: string): Promise<readonly Attempt[]>;
  getGoals(learnerId: string): Promise<Goals>;
  setGoals(learnerId: string, goals: Goals): Promise<boolean>;
}

export const ATTEMPTS_KEY = 'pianoArcade.mastery.attempts.v1';
export const GOALS_KEY = 'pianoArcade.mastery.goals.v1';
const noGoals: Goals = { songIds: [] };

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads an attempt from untrusted JSON (storage or a request body), keeping only its known fields. */
export function parseAttempt(value: unknown): Attempt | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const { id, learnerId, at, itemId, nodeId, mode, correct, cold, helpShare, revealed, kind, details } = v;
  if (typeof id !== 'string' || typeof learnerId !== 'string' || typeof itemId !== 'string') return null;
  if (typeof nodeId !== 'string' || typeof at !== 'string' || !Number.isFinite(Date.parse(at))) return null;
  if (mode !== 'diagnostic' && mode !== 'activity') return null;
  if (typeof correct !== 'boolean' || typeof cold !== 'boolean' || typeof revealed !== 'boolean') return null;
  if (!isNumber(helpShare) || helpShare < 0 || helpShare > 1) return null;
  if (typeof details !== 'object' || details === null) return null;
  const base = { id, learnerId, at, itemId, nodeId, mode, correct, cold, helpShare, revealed } as const;
  const d = details as Record<string, unknown>;
  if (kind === 'theory') {
    return typeof d.choiceId === 'string' ? { ...base, kind, details: { choiceId: d.choiceId } } : null;
  }
  if (kind !== 'playing') return null;
  const { notesInOrder, timingSpreadMs, velocitySpread, legato, pedal } = d;
  if (!isNumber(notesInOrder) || !isNumber(timingSpreadMs) || !isNumber(velocitySpread)) return null;
  if ((legato !== undefined && !isNumber(legato)) || (pedal !== undefined && !isNumber(pedal))) return null;
  return {
    ...base,
    kind,
    details: {
      notesInOrder,
      timingSpreadMs,
      velocitySpread,
      ...(legato === undefined ? {} : { legato }),
      ...(pedal === undefined ? {} : { pedal }),
    },
  };
}

function parseGoals(value: unknown): Goals | null {
  if (typeof value !== 'object' || value === null) return null;
  const { songIds } = value as Record<string, unknown>;
  return Array.isArray(songIds) && songIds.every(s => typeof s === 'string') ? { songIds } : null;
}

/** Storage can be missing (private mode, a server render) or hold anything; either way it reads as nothing. */
function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function readAttempts(): Attempt[] {
  const raw = read(ATTEMPTS_KEY);
  return Array.isArray(raw) ? raw.map(parseAttempt).filter((a): a is Attempt => a !== null) : [];
}

function readGoals(): Record<string, unknown> {
  const raw = read(GOALS_KEY);
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/**
 * The store on this device: every learner's attempts in one list and goals by learner, in `localStorage`. Appending
 * an id already stored is a no-op that succeeds, so a retried write can't count an attempt twice.
 */
export const deviceStore: AttemptStore = {
  async append(attempt) {
    const attempts = readAttempts();
    if (attempts.some(a => a.id === attempt.id)) return true;
    return write(ATTEMPTS_KEY, [...attempts, attempt]);
  },
  async list(learnerId) {
    return readAttempts().filter(a => a.learnerId === learnerId);
  },
  async getGoals(learnerId) {
    return parseGoals(readGoals()[learnerId]) ?? noGoals;
  },
  async setGoals(learnerId, goals) {
    return write(GOALS_KEY, { ...readGoals(), [learnerId]: { songIds: [...goals.songIds] } });
  },
};
