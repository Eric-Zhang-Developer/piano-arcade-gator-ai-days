// The chat route against a mocked Messages API: a reply, no key, upstream trouble, and requests past the caps.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_LIMITS, type ChatRequest, findGate, theoryGates } from '../../../../learn/frontend/theory';
import { POST } from './route';

const chat: ChatRequest = {
  gateId: 'endings',
  questionId: 'phrase-1-end',
  attempts: [{ type: 'answer', gateId: 'endings', questionId: 'phrase-1-end', choiceId: 'c' }],
  history: [
    { role: 'tutor', text: 'Which note does phrase 1 stop on?' },
    { role: 'student', text: 'Is it C?' },
  ],
};

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/learn/api/chat', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

const message = (text: string, stop_reason = 'end_turn') =>
  Response.json({
    content: [
      { type: 'thinking', thinking: 'The student guessed C.', signature: 'sig' },
      { type: 'text', text },
    ],
    stop_reason,
  });

const fetchMock = () => vi.mocked(fetch);
const sentBody = () => JSON.parse(fetchMock().mock.calls[0][1]?.body as string);

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('LEARN_CHAT_MODEL', '');
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /learn/api/chat', () => {
  it('answers with the tutor reply from the Messages API', async () => {
    fetchMock().mockResolvedValue(message('  Listen to phrase 1 again. Does it sound finished?  '));
    const res = await post(chat);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', reply: 'Listen to phrase 1 again. Does it sound finished?' });
    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init?.headers).toMatchObject({ 'x-api-key': 'test-key', 'anthropic-version': '2026-10-21' });
    const body = sentBody();
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.messages).toEqual([{ role: 'user', content: 'Is it C?' }]);
    expect(body.system).toContain(findGate(theoryGates, 'endings')?.title);
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('thinking');
  });

  it('uses LEARN_CHAT_MODEL when it is set', async () => {
    vi.stubEnv('LEARN_CHAT_MODEL', 'claude-sonnet-5-5');
    fetchMock().mockResolvedValue(message('What is the last note?'));
    await post(chat);
    expect(sentBody().model).toBe('claude-sonnet-5-5');
  });

  it('answers 503 not-configured without a key, and never calls out', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const res = await post(chat);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'not-configured' });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it.each([
    ['an error status', () => fetchMock().mockResolvedValue(new Response('overloaded', { status: 529 }))],
    ['a failed request', () => fetchMock().mockRejectedValue(new TypeError('fetch failed'))],
    ['a refusal', () => fetchMock().mockResolvedValue(message('', 'refusal'))],
    ['a cut-off reply', () => fetchMock().mockResolvedValue(message('Listen to', 'max_tokens'))],
    ['a reply with no text', () => fetchMock().mockResolvedValue(message('   '))],
  ])('answers 502 error on %s upstream', async (_, upstream) => {
    upstream();
    const res = await post(chat);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ status: 'error', message: expect.any(String) });
  });

  it.each([
    ['a message past the character cap', { ...chat, history: [{ role: 'student', text: 'a'.repeat(CHAT_LIMITS.messageChars + 1) }] }],
    [
      'a history past the message cap',
      { ...chat, history: Array.from({ length: CHAT_LIMITS.history + 1 }, () => ({ role: 'student', text: 'Is it C?' })) },
    ],
    ['a body past the byte cap', JSON.stringify({ ...chat, padding: 'a'.repeat(512 * 1024) })],
  ])('answers 413 on %s, and never calls out', async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ status: 'error' });
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it.each([
    ['a body that is not JSON', '{"gateId":'],
    ['an unknown gate', { ...chat, gateId: 'nowhere' }],
    ['a conversation that ends with the tutor', { ...chat, history: [{ role: 'tutor', text: 'Hello.' }] }],
  ])('answers 400 on %s, and never calls out', async (_, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: 'error' });
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});
