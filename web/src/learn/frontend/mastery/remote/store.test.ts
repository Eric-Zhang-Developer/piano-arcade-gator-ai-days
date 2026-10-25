// The remote store against a mocked route and an in-memory device store: it saves to both, reads the server when it
// answers, keeps working on the device when it doesn't, and sends the device's unsent attempts once it's back.
import { describe, expect, it, vi } from 'vitest';
import type { AttemptStore } from '../engine';
import type { Attempt, Goals } from '../schema';
import type { AttemptsResponse } from './protocol';
import { remoteStore } from './store';

const attempt = (id: string, at: string, learnerId = 'me'): Attempt => ({
  id,
  learnerId,
  at,
  itemId: 'names-1',
  nodeId: 'names',
  mode: 'activity',
  correct: true,
  cold: true,
  helpShare: 0,
  revealed: false,
  kind: 'theory',
  details: { choiceId: 'right' },
});
const a1 = attempt('a1', '2026-10-01T12:00:00.000Z');
const a2 = attempt('a2', '2026-10-01T12:01:00.000Z');
const a3 = attempt('a3', '2026-10-01T12:02:00.000Z');

function memoryStore(attempts: Attempt[] = [], goals: Goals = { songIds: [] }): AttemptStore {
  return {
    append: async a => (attempts.push(a), true),
    list: async id => attempts.filter(a => a.learnerId === id),
    getGoals: async () => goals,
    setGoals: async (_, g) => ((goals = g), true),
  };
}

const session = async () => ({ token: 'tok', userId: 'me' });
type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const route = (reply: AttemptsResponse, status = 200) => vi.fn<Fetch>(async () => Response.json(reply, { status }));
const sent = (fetch: ReturnType<typeof route>) =>
  fetch.mock.calls.map(([, init]) => (init?.body ? JSON.parse(init.body as string) : (init?.method ?? 'GET')));

describe('remoteStore', () => {
  it('appends to the device and posts to the route with the session token', async () => {
    const fallback = memoryStore();
    const fetch = route({ status: 'saved' }, 201);
    expect(await remoteStore({ session, fallback, fetch }).append(a1)).toBe(true);

    expect(await fallback.list('me')).toEqual([a1]);
    const [[url, init]] = fetch.mock.calls;
    expect(url).toBe('/learn/api/attempts');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(JSON.parse(init?.body as string)).toEqual({ attempt: a1 });
  });

  it('lists the server attempts with the device ones it has not seen, oldest first, and sends those along', async () => {
    const fallback = memoryStore([a3, a1]);
    const fetch = vi.fn<Fetch>(async (_, init) =>
      Response.json(init?.method === 'POST' ? { status: 'saved' } : { status: 'ok', attempts: [a1, a2], goals: { songIds: [] } }),
    );
    expect(await remoteStore({ session, fallback, fetch }).list('me')).toEqual([a1, a2, a3]);
    expect(sent(fetch)).toEqual(['GET', { attempt: a3 }]);
  });

  it('reads the server goals, and the device goals when the server has none', async () => {
    const fallback = memoryStore([], { songIds: ['minuet-in-g'] });
    const withGoals = route({ status: 'ok', attempts: [], goals: { songIds: ['ode-to-joy'] } });
    expect(await remoteStore({ session, fallback, fetch: withGoals }).getGoals('me')).toEqual({ songIds: ['ode-to-joy'] });
    const without = route({ status: 'ok', attempts: [], goals: { songIds: [] } });
    expect(await remoteStore({ session, fallback, fetch: without }).getGoals('me')).toEqual({ songIds: ['minuet-in-g'] });
  });

  it('saves goals to both', async () => {
    const fallback = memoryStore();
    const fetch = route({ status: 'saved' });
    expect(await remoteStore({ session, fallback, fetch }).setGoals('me', { songIds: ['ode-to-joy'] })).toBe(true);
    expect(await fallback.getGoals('me')).toEqual({ songIds: ['ode-to-joy'] });
    expect(sent(fetch)).toEqual([{ goals: { songIds: ['ode-to-joy'] } }]);
  });

  it.each([
    ['not-ready', route({ status: 'not-ready' }, 503)],
    ['not-configured', route({ status: 'not-configured' }, 503)],
    ['an error', route({ status: 'error', message: 'read failed' }, 502)],
    ['offline', vi.fn<Fetch>(async () => Promise.reject(new TypeError('fetch failed')))],
  ])('falls back to the device when the route is %s', async (_, fetch) => {
    const store = remoteStore({ session, fallback: memoryStore([a1], { songIds: ['minuet-in-g'] }), fetch });
    expect(await store.append(a2)).toBe(true);
    expect(await store.list('me')).toEqual([a1, a2]);
    expect(await store.getGoals('me')).toEqual({ songIds: ['minuet-in-g'] });
  });

  it('never calls the route without a session, or for another learner', async () => {
    const fetch = route({ status: 'saved' });
    const fallback = memoryStore([attempt('x', a1.at, 'someone-else')]);
    await remoteStore({ session: async () => null, fallback, fetch }).append(a1);
    expect(await remoteStore({ session, fallback, fetch }).list('someone-else')).toHaveLength(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a failed write only when neither the device nor the server kept it', async () => {
    const full: AttemptStore = { ...memoryStore(), append: async () => false };
    expect(await remoteStore({ session, fallback: full, fetch: route({ status: 'saved' }, 201) }).append(a1)).toBe(true);
    expect(await remoteStore({ session, fallback: full, fetch: route({ status: 'not-ready' }, 503) }).append(a1)).toBe(false);
  });
});
