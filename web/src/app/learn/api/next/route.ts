// POST /learn/api/next: the student's next session. It takes a NextRequest (the attempts and goals the device
// holds) and answers with a NextSession. The engine replays the attempts and the graph gives the candidates, so the
// route stays stateless and trusts nothing else; the model picks among them, or the fallback does with no key.
import { curriculum } from '../../../../learn/frontend/mastery/curriculum';
import { decideNext, DEFAULT_MODEL } from '../../../../learn/frontend/mastery/decide';
import { parseAttempt } from '../../../../learn/frontend/mastery/engine';
import type { Attempt, NextRequest } from '../../../../learn/frontend/mastery/schema';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // thousands of attempts fit; bigger bodies are refused unread
/** The most attempts replayed; past it only the latest count, which are the ones that decide colour and recall. */
const MAX_ATTEMPTS = 5000;
/** The most goal songs that weigh on a decision. */
const MAX_GOALS = 3;

const send = (body: unknown, status = 200) => Response.json(body, { status });

/** The body as text, or null once it passes the cap. Reading stops there, so a huge body is never buffered. */
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

/**
 * The request, or null when its shape is wrong. Attempts that don't parse are dropped and only the latest
 * MAX_ATTEMPTS kept; goal songs the graph doesn't tag are dropped and at most MAX_GOALS kept.
 */
function parseNextRequest(body: unknown): NextRequest | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { attempts, goals } = body as Record<string, unknown>;
  if (!Array.isArray(attempts)) return null;
  let songIds: unknown = [];
  if (goals !== undefined) {
    if (typeof goals !== 'object' || goals === null) return null;
    songIds = (goals as Record<string, unknown>).songIds ?? [];
    if (!Array.isArray(songIds)) return null;
  }
  const tagged = new Set(curriculum.songs.map(s => s.songId));
  const goalIds = [...new Set((songIds as unknown[]).filter((s): s is string => typeof s === 'string' && tagged.has(s)))];
  const parsed = attempts.map(parseAttempt).filter((a): a is Attempt => a !== null);
  const latest = parsed
    .map(a => ({ a, t: Date.parse(a.at) }))
    .sort((x, y) => x.t - y.t)
    .slice(-MAX_ATTEMPTS)
    .map(x => x.a);
  return { attempts: latest, goals: { songIds: goalIds.slice(0, MAX_GOALS) } };
}

export async function POST(request: Request) {
  const raw = await readBody(request);
  if (raw === null) return send({ error: 'That request is too large.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return send({ error: 'That request is not JSON.' }, 400);
  }
  const next = parseNextRequest(body);
  if (!next) return send({ error: 'That request needs attempts and goals.' }, 400);

  const session = await decideNext({
    curriculum,
    request: next,
    now: new Date(),
    key: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
    model: process.env.LEARN_NEXT_MODEL?.trim() || DEFAULT_MODEL,
  });
  return send(session);
}
