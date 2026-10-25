import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { curriculum } from '../../../../learn/frontend/mastery/curriculum';
import type { NextSession } from '../../../../learn/frontend/mastery/schema';
import { POST } from './route';

const url = 'http://localhost/learn/api/next';
const post = (body: BodyInit, headers: HeadersInit = {}) => POST(new Request(url, { method: 'POST', body, headers }));
const ask = (body: unknown) => post(JSON.stringify(body));
const goal = curriculum.songs[0]?.songId;
const reply = (text: string) => Response.json({ content: [{ type: 'text', text }], stop_reason: 'end_turn' });

let fetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('LEARN_NEXT_MODEL', '');
  fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The fallback a new student gets, which names real candidate node ids to build model replies from. */
async function coldStart(): Promise<NextSession> {
  vi.stubEnv('ANTHROPIC_API_KEY', '');
  const session = (await (await ask({ attempts: [], goals: { songIds: [goal] } })).json()) as NextSession;
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  return session;
}

describe('POST /learn/api/next', () => {
  it('refuses an oversized request by its declared length, unread', async () => {
    const res = await post('{}', { 'content-length': String(3 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'That request is too large.' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an oversized request that declares no length', async () => {
    const huge = JSON.stringify({ attempts: [], goals: { songIds: [] }, pad: 'x'.repeat(2 * 1024 * 1024) });
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(huge));
        c.close();
      },
    });
    const res = await POST(new Request(url, { method: 'POST', body: stream, duplex: 'half' } as RequestInit));
    expect(res.status).toBe(413);
  });

  it('refuses a body that is not JSON or has the wrong shape', async () => {
    expect((await post('{nope')).status).toBe(400);
    const missing = await ask({ goals: { songIds: [] } });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'That request needs attempts and goals.' });
    expect((await ask({ attempts: [], goals: { songIds: 'song' } })).status).toBe(400);
    expect((await ask([])).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('plans from the graph alone without a key', async () => {
    const session = await coldStart();
    expect(fetch).not.toHaveBeenCalled();
    expect(session.source).toBe('fallback');
    expect(session.activities.length).toBeGreaterThanOrEqual(3);
    expect(session.activities.length).toBeLessThanOrEqual(5);
    const ids = new Set(curriculum.nodes.map(n => n.id));
    for (const a of session.activities) {
      expect(ids.has(a.nodeId)).toBe(true);
      expect(a.keywords.every(k => ids.has(k))).toBe(true);
    }
  });

  it('keeps a model plan that passes the graph check, with the model from LEARN_NEXT_MODEL', async () => {
    const picks = (await coldStart()).activities.slice(0, 3);
    vi.stubEnv('LEARN_NEXT_MODEL', 'claude-sonnet-5-5');
    fetch.mockResolvedValue(
      reply(JSON.stringify({ activities: picks.map(a => ({ nodeId: a.nodeId, keywords: [a.nodeId], reason: 'Start here.' })) })),
    );
    const res = await ask({ attempts: [], goals: { songIds: [goal] } });
    const session = (await res.json()) as NextSession;
    expect(res.status).toBe(200);
    expect(session.source).toBe('model');
    expect(session.activities.map(a => a.nodeId)).toEqual(picks.map(a => a.nodeId));
    expect(session.activities.map(a => a.activity)).toEqual(picks.map(a => a.activity));
    const [, init] = fetch.mock.calls[0];
    expect(init.headers['x-api-key']).toBe('test-key');
    expect(JSON.parse(init.body).model).toBe('claude-sonnet-5-5');
  });

  it('falls back when the upstream errors or the reply is rejected', async () => {
    const fallback = await coldStart();
    fetch.mockResolvedValueOnce(new Response('server error', { status: 500 }));
    const down = (await (await ask({ attempts: [], goals: { songIds: [goal] } })).json()) as NextSession;
    expect(down).toEqual(fallback);

    fetch.mockResolvedValueOnce(reply('{"activities": [{"nodeId": "not-a-node", "keywords": [], "reason": "x"}]}'));
    const rejected = (await (await ask({ attempts: [], goals: { songIds: [goal] } })).json()) as NextSession;
    expect(rejected).toEqual(fallback);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
