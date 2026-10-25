// Viewing /learn as a synthetic learner, against stubbed browser storage: `?as=` picks a known synthetic id and
// nothing else, Exit clears it, and while viewing the stores read the simulation and write only this tab's storage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTEMPTS_KEY, type AttemptStore, GOALS_KEY } from '../mastery/engine';
import { learnerId } from '../mastery/diagnostic/learner';
import { remoteStore } from '../mastery/remote';
import type { Attempt } from '../mastery/schema';
import { syntheticLearner } from '../mastery/sim';
import { clearViewAs, SYNTHETIC_KEY, VIEW_AS_KEY, viewingAs } from './view-as';

vi.mock('../../../data/config', () => ({ isConfigured: () => true }));
vi.mock('../../../data/auth', () => ({
  ensureSession: async () => ({ user_id: 'device-user', access_token: 'tok' }),
  getSession: async () => ({ user_id: 'device-user', access_token: 'tok' }),
}));

const storage = () => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
};
let session: ReturnType<typeof storage>, local: ReturnType<typeof storage>;
const at = (search: string) => vi.stubGlobal('window', { location: { search, assign: vi.fn() } });

beforeEach(() => {
  session = storage();
  local = storage();
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('localStorage', local);
  at('');
});
afterEach(() => vi.unstubAllGlobals());

const attempt = (id: string, learner: string): Attempt => ({
  id, learnerId: learner, at: '2030-01-01T12:00:00.000Z', itemId: 'names-1', nodeId: 'names', mode: 'activity',
  correct: true, cold: true, helpShare: 0, revealed: false, kind: 'theory', details: { choiceId: 'right' },
});

describe('viewingAs', () => {
  it('takes a known synthetic id from ?as= and keeps it for the tab', async () => {
    at('?as=synthetic-042');
    expect(viewingAs()).toBe('synthetic-042');
    expect(session.map.get(VIEW_AS_KEY)).toBe('synthetic-042');
    at('');
    expect(viewingAs()).toBe('synthetic-042');
    expect(await learnerId()).toBe('synthetic-042');
  });

  it.each(['device-user', 'synthetic-000', 'synthetic-201', 'synthetic-42', 'Synthetic-042', ''])(
    'ignores ?as=%s', async id => {
      at(`?as=${id}`);
      expect(viewingAs()).toBeNull();
      expect(session.map.has(VIEW_AS_KEY)).toBe(false);
      expect(await learnerId()).toBe('device-user');
    },
  );

  it('ignores an unknown id left in storage', () => {
    session.setItem(VIEW_AS_KEY, 'someone-else');
    expect(viewingAs()).toBeNull();
  });

  it('keeps the viewed learner when a later ?as= is not a synthetic id', () => {
    at('?as=synthetic-007');
    viewingAs();
    at('?as=device-user');
    expect(viewingAs()).toBe('synthetic-007');
  });

  it('is nobody on the server', () => {
    vi.stubGlobal('window', undefined);
    expect(viewingAs()).toBeNull();
  });

  it('Exit clears the learner and what was kept for them, so the device learner is back', async () => {
    at('?as=synthetic-042');
    viewingAs();
    await remoteStore().append(attempt('kept', 'synthetic-042'));
    at('');
    clearViewAs();
    expect(session.map.has(VIEW_AS_KEY)).toBe(false);
    expect(session.map.has(SYNTHETIC_KEY)).toBe(false);
    expect(viewingAs()).toBeNull();
    expect(await learnerId()).toBe('device-user');
  });
});

describe('the store while viewing', () => {
  const id = 'synthetic-042';
  const learner = syntheticLearner(id)!;
  let store: AttemptStore, send: ReturnType<typeof vi.fn<typeof fetch>>, fallback: AttemptStore;
  beforeEach(() => {
    send = vi.fn<typeof fetch>(async () => Response.json({ status: 'saved' }));
    fallback = { append: vi.fn(), list: vi.fn(), getGoals: vi.fn(), setGoals: vi.fn() };
    store = remoteStore({ fetch: send, fallback, session: async () => ({ token: 'tok', userId: id }) });
  });

  it("lists the synthetic learner's simulated attempts and goals", async () => {
    expect(await store.list(id)).toEqual([...learner.attempts]);
    expect(await store.getGoals(id)).toEqual(learner.goals);
  });

  it('keeps appended attempts and goals in this tab only, never the server or the device', async () => {
    const mine = attempt('mine', id);
    expect(await store.append(mine)).toBe(true);
    expect(await store.append(mine)).toBe(true);
    expect(await store.setGoals(id, { songIds: ['ode-to-joy'] })).toBe(true);

    expect(await store.list(id)).toEqual([...learner.attempts, mine]);
    expect(await store.getGoals(id)).toEqual({ songIds: ['ode-to-joy'] });
    expect(send).not.toHaveBeenCalled();
    for (const method of Object.values(fallback)) expect(method).not.toHaveBeenCalled();
    expect([...local.map.keys()].filter(k => k === ATTEMPTS_KEY || k === GOALS_KEY)).toEqual([]);
    expect(local.map.size).toBe(0);
    expect([...session.map.keys()]).toEqual([SYNTHETIC_KEY]);
  });

  it('refuses a write it cannot keep instead of losing it silently', async () => {
    vi.stubGlobal('sessionStorage', { ...session, setItem: () => { throw new Error('full'); } });
    expect(await store.append(attempt('lost', id))).toBe(false);
  });
});
