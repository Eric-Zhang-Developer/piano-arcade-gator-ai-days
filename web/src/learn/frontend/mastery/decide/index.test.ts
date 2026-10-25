import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { curriculum, masterScale, start } from './fixtures';
import { decideNext, DEFAULT_MODEL } from './index';

const reply = (text: string, stop_reason = 'end_turn') => Response.json({ content: [{ type: 'text', text }], stop_reason });
const goodPlan = JSON.stringify({
  activities: ['chords', 'steps', 'keys'].map(nodeId => ({ nodeId, keywords: [nodeId, 'scale'], reason: `Try ${nodeId}.` })),
});
const input = (fetch: typeof globalThis.fetch, key: string | null = 'test-key') => ({
  curriculum,
  request: { attempts: masterScale(), goals: { songIds: ['song-a', 'song-b'] } },
  now: new Date(start + 200_000),
  key: key ?? undefined,
  model: DEFAULT_MODEL,
  fetch,
});

let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  info = vi.spyOn(console, 'info').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const logged = () => info.mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe('decideNext', () => {
  it('falls back to the top candidates without calling the model when there is no key', async () => {
    const fetch = vi.fn();
    const got = await decideNext(input(fetch, null));
    expect(fetch).not.toHaveBeenCalled();
    expect(got.source).toBe('fallback');
    expect(got.activities.map(a => a.nodeId)).toEqual(['chords', 'steps', 'keys']);
    expect(logged()).toMatchObject({ fallbackBecause: 'no key', model: null, attempts: 3 });
  });

  it('asks the Messages API with the key, version and model, and keeps a plan that passes the graph check', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(goodPlan));
    const got = await decideNext(input(fetch));
    expect(got).toEqual({
      source: 'model',
      activities: [
        { nodeId: 'chords', activity: 'practice', keywords: ['chords', 'scale'], reason: 'Try chords.' },
        { nodeId: 'steps', activity: 'sandbox', keywords: ['steps', 'scale'], reason: 'Try steps.' },
        { nodeId: 'keys', activity: 'sandbox', keywords: ['keys', 'scale'], reason: 'Try keys.' },
      ],
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({ 'x-api-key': 'test-key', 'anthropic-version': expect.any(String) });
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.system).toContain('never');
    expect(body.messages[0].content).toContain('"nodeId": "chords"');
    expect(logged()).toMatchObject({ model: 'claude-opus-5-5', activities: ['practice:chords', 'sandbox:steps', 'sandbox:keys'] });
    expect(logged()).not.toHaveProperty('fallbackBecause');
  });

  it('falls back when the upstream errors or the request fails', async () => {
    const down = vi.fn().mockResolvedValue(new Response('overloaded', { status: 529 }));
    const got = await decideNext(input(down));
    expect(got.source).toBe('fallback');
    expect(logged()).toMatchObject({ fallbackBecause: 'upstream 529: overloaded' });
    expect(error).toHaveBeenCalledWith('learn next: the Messages API gave no plan', 'upstream 529: overloaded');

    const offline = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    expect((await decideNext(input(offline))).source).toBe('fallback');
    expect(logged()).toMatchObject({ fallbackBecause: 'request failed: getaddrinfo ENOTFOUND' });
  });

  it('falls back when the reply is cut off', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(goodPlan.slice(0, 40), 'max_tokens'));
    expect((await decideNext(input(fetch))).source).toBe('fallback');
    expect(logged()).toMatchObject({ fallbackBecause: 'no reply (stop_reason max_tokens)' });
  });

  it('falls back when the reply fails the graph check', async () => {
    const offList = JSON.stringify({
      activities: ['chords', 'steps', 'far'].map(nodeId => ({ nodeId, keywords: [nodeId], reason: 'Go.' })),
    });
    const fetch = vi.fn().mockResolvedValue(reply(offList));
    const got = await decideNext(input(fetch));
    expect(got.source).toBe('fallback');
    expect(got.activities.map(a => a.nodeId)).toEqual(['chords', 'steps', 'keys']);
    expect(logged()).toMatchObject({ fallbackBecause: 'rejected: off-list node far' });
    expect(error.mock.calls[0][0]).toBe('learn next: the plan failed the graph check');
  });
});
