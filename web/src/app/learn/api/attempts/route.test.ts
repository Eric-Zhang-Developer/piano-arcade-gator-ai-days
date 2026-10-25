// The attempts route against a mocked session and a mocked PostgREST: saving through Sharan's functions (#1225),
// listing, goals, validation, and the two ways the store can be unavailable (no server key, not migrated yet).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from '../../../../learn/frontend/mastery/schema';
import { GET, POST } from './route';

vi.mock('../../../../data/server', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../data/server')>()),
  isServerConfigured: vi.fn(() => true),
  userFromToken: vi.fn(async (token: string | null) => (token === 'good' ? { id: 'player-1', isAnonymous: true } : null)),
}));
const server = await import('../../../../data/server');

const ID = '0b6c1f9e-3d2a-4c5b-8e7f-1a2b3c4d5e6f';
const attempt: Attempt = {
  id: ID,
  learnerId: 'someone-else',
  at: '2026-10-01T12:00:00.000Z',
  itemId: 'names-1',
  nodeId: 'names',
  mode: 'activity',
  correct: true,
  cold: true,
  helpShare: 0,
  revealed: false,
  kind: 'theory',
  details: { choiceId: 'right' },
};
const row = {
  id: ID,
  player_id: 'player-1',
  created_at: attempt.at,
  item_id: 'names-1',
  node_id: 'names',
  kind: 'theory',
  mode: 'activity',
  correct: true,
  cold: true,
  help_share: 0,
  revealed: false,
  details: { choiceId: 'right' },
};

const request = (method: 'GET' | 'POST', body?: unknown, token = 'good') =>
  new Request('http://localhost/learn/api/attempts', {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });

const fetchMock = () => vi.mocked(fetch);
const calls = () => fetchMock().mock.calls.map(([url, init]) => ({ url: String(url), init }));
const missingTable = () =>
  new Response(JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.learning_attempts'" }), {
    status: 404,
  });

beforeEach(() => {
  vi.stubEnv('SUPABASE_SECRET_KEY', 'secret');
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /learn/api/attempts', () => {
  it('saves the attempt through save_learning_attempt for the session player, whatever learnerId the body claims', async () => {
    fetchMock().mockResolvedValue(Response.json('saved'));
    const res = await POST(request('POST', { attempt }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ status: 'saved' });
    const [save] = calls();
    expect(save.url).toContain('/rest/v1/rpc/save_learning_attempt');
    expect(save.init?.method).toBe('POST');
    expect(save.init?.headers).toMatchObject({ apikey: 'secret' });
    expect(JSON.parse(save.init?.body as string)).toEqual({ p: row });
    expect(calls()).toHaveLength(1);
  });

  it.each([
    ['duplicate', 200, { status: 'saved' }],
    ['conflict', 409, { status: 'error' }],
    ['limited', 429, { status: 'limited' }],
  ] as const)('answers %s with %i', async (outcome, status, body) => {
    fetchMock().mockResolvedValue(Response.json(outcome));
    const res = await POST(request('POST', { attempt }));
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject(body);
  });

  it('answers 502 on an answer the function never gives', async () => {
    fetchMock().mockResolvedValue(Response.json('maybe'));
    expect((await POST(request('POST', { attempt }))).status).toBe(502);
  });

  it('replaces the goals through set_learner_goals', async () => {
    fetchMock().mockResolvedValue(Response.json(['ode-to-joy', 'minuet-in-g']));
    const res = await POST(request('POST', { goals: { songIds: ['ode-to-joy', 'minuet-in-g'] } }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'saved' });
    const [set] = calls();
    expect(set.url).toContain('/rest/v1/rpc/set_learner_goals');
    expect(set.init?.method).toBe('POST');
    expect(JSON.parse(set.init?.body as string)).toEqual({
      p_player: 'player-1',
      p_song_ids: ['ode-to-joy', 'minuet-in-g'],
    });
  });

  it.each([
    ['a body that is not JSON', '{"attempt":'],
    ['a malformed attempt', { attempt: { ...attempt, correct: 'yes' } }],
    ['an attempt id that is not a UUID', { attempt: { ...attempt, id: 'a1' } }],
    ['a bad node id', { attempt: { ...attempt, nodeId: 'Names Node!' } }],
    ['an attempt from next week', { attempt: { ...attempt, at: new Date(Date.now() + 7 * 864e5).toISOString() } }],
    ['too many goal songs', { goals: { songIds: ['a', 'b', 'c', 'd'] } }],
    ['repeated goal songs', { goals: { songIds: ['a', 'a'] } }],
  ])('answers 400 on %s, and never calls the database', async (_, body) => {
    const res = await POST(request('POST', body));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 'error' });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('answers 413 on a body past the cap', async () => {
    const res = await POST(request('POST', { attempt, padding: 'a'.repeat(16 * 1024) }));
    expect(res.status).toBe(413);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('answers 424 when the database refuses a row', async () => {
    fetchMock().mockResolvedValue(new Response('{"code":"23514"}', { status: 400 }));
    const res = await POST(request('POST', { attempt }));
    expect(res.status).toBe(424);
  });
});

describe('GET /learn/api/attempts', () => {
  it('lists the player attempts and goals', async () => {
    fetchMock().mockImplementation(async url =>
      String(url).includes('learner_goals')
        ? Response.json([{ song_ids: ['ode-to-joy'] }])
        : Response.json([row, { ...row, id: 'not-an-attempt', correct: 'yes' }]),
    );
    const res = await GET(request('GET'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      attempts: [{ ...attempt, learnerId: 'player-1' }],
      goals: { songIds: ['ode-to-joy'] },
    });
    expect(calls()[0].url).toContain('player_id=eq.player-1');
  });

  it('answers empty goals when the player has none', async () => {
    fetchMock().mockImplementation(async () => Response.json([]));
    expect(await (await GET(request('GET'))).json()).toEqual({ status: 'ok', attempts: [], goals: { songIds: [] } });
  });
});

describe('when the store is unavailable', () => {
  it.each([['GET'], ['POST']] as const)('%s answers 503 not-configured without the server key', async method => {
    vi.mocked(server.isServerConfigured).mockReturnValueOnce(false);
    const res = await (method === 'GET' ? GET(request('GET')) : POST(request('POST', { attempt })));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'not-configured' });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it.each([['GET'], ['POST']] as const)('%s answers 503 not-ready before the tables exist', async method => {
    fetchMock().mockImplementation(async () => missingTable());
    const res = await (method === 'GET' ? GET(request('GET')) : POST(request('POST', { attempt })));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'not-ready' });
  });

  it('POST answers 503 not-ready before the save function exists', async () => {
    fetchMock().mockResolvedValue(
      new Response(JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }), { status: 404 }),
    );
    const res = await POST(request('POST', { attempt }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'not-ready' });
  });

  it('answers 401 without a session', async () => {
    const res = await GET(request('GET', undefined, 'bad'));
    expect(res.status).toBe(401);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it('answers 502 when the database is down', async () => {
    fetchMock().mockResolvedValue(new Response('upstream', { status: 503 }));
    expect((await GET(request('GET'))).status).toBe(502);
  });
});
