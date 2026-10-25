import { getSession } from '../../../../data/auth';
import { type AttemptStore, deviceStore } from '../engine';
import type { Attempt } from '../schema';
import { ATTEMPTS_ROUTE, type AttemptsRequest, type AttemptsResponse } from './protocol';

/** Who the route will store attempts for: the take store's Supabase session (anonymous or Google). */
export type RemoteSession = { token: string; userId: string };

export type RemoteStoreOptions = {
  session?: () => Promise<RemoteSession | null>;
  fallback?: AttemptStore;
  fetch?: typeof fetch;
};

const takeStoreSession = async (): Promise<RemoteSession | null> => {
  const s = await getSession();
  return s ? { token: s.access_token, userId: s.user_id } : null;
};

const byTime = (a: Attempt, b: Attempt) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id);

/**
 * Attempts and goals in Supabase through `/learn/api/attempts`, with the device store underneath. Every write lands
 * on the device first, so nothing is lost while the route is unconfigured, not ready (#753) or offline; reads use
 * the server when it answers and the device otherwise. Only the session's own learner id goes to the server.
 * When the server answers, attempts it hasn't seen yet (kept while it was away) are sent along.
 */
export function remoteStore(options: RemoteStoreOptions = {}): AttemptStore {
  const session = options.session ?? takeStoreSession;
  const fallback = options.fallback ?? deviceStore;
  const send = options.fetch ?? ((input, init) => fetch(input, init));

  /** The server's answer, or null when it can't be reached or doesn't serve this learner. */
  async function call(learnerId: string, body?: AttemptsRequest): Promise<AttemptsResponse | null> {
    try {
      const s = await session();
      if (!s || s.userId !== learnerId) return null;
      const res = await send(ATTEMPTS_ROUTE, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${s.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return (await res.json()) as AttemptsResponse;
    } catch {
      return null;
    }
  }

  const read = async (learnerId: string) => {
    const reply = await call(learnerId);
    return reply?.status === 'ok' ? reply : null;
  };

  return {
    async append(attempt) {
      const kept = await fallback.append(attempt);
      const reply = await call(attempt.learnerId, { attempt });
      return kept || reply?.status === 'saved';
    },
    async list(learnerId) {
      const [local, remote] = await Promise.all([fallback.list(learnerId), read(learnerId)]);
      if (!remote) return local;
      const seen = new Set(remote.attempts.map(a => a.id));
      const unsent = local.filter(a => !seen.has(a.id));
      await Promise.all(unsent.map(attempt => call(learnerId, { attempt })));
      return [...remote.attempts, ...unsent].sort(byTime);
    },
    async getGoals(learnerId) {
      const [local, remote] = await Promise.all([fallback.getGoals(learnerId), read(learnerId)]);
      return remote && remote.goals.songIds.length ? remote.goals : local;
    },
    async setGoals(learnerId, goals) {
      const kept = await fallback.setGoals(learnerId, goals);
      const reply = await call(learnerId, { goals });
      return kept || reply?.status === 'saved';
    },
  };
}
