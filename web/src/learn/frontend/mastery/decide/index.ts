import { replay } from '../engine';
import type { Curriculum, NextRequest, NextSession } from '../schema';
import { buildCandidates } from './candidates';
import { fallbackPlan } from './fallback';
import { plannerMessage, SYSTEM_PROMPT } from './prompt';
import { validatePlan } from './validate';

export { activityOf, activityRoute, buildCandidates, type Candidate, MAX_CANDIDATES, MAX_NEW } from './candidates';
export { fallbackPlan } from './fallback';
export { plannerMessage, SYSTEM_PROMPT } from './prompt';
export { type Checked, MAX_ACTIVITIES, MIN_ACTIVITIES, validatePlan } from './validate';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2026-10-21';
export const DEFAULT_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 8000; // the model thinks before it answers; this leaves room
const TIMEOUT_MS = 60_000;

export type DecideInput = {
  curriculum: Curriculum;
  request: NextRequest;
  now: Date;
  /** The Messages API key; with none the plan is the fallback. */
  key: string | undefined;
  model: string;
  fetch?: typeof fetch;
};

/** The reply's text, or null when the model didn't finish a plain answer (cut off, refused, or empty). */
function replyText(message: unknown): string | null {
  if (typeof message !== 'object' || message === null) return null;
  const { stop_reason, content } = message as Record<string, unknown>;
  if (stop_reason !== 'end_turn' || !Array.isArray(content)) return null;
  const text = content
    .filter((b): b is { type: 'text'; text: string } => b?.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('')
    .trim();
  return text || null;
}

/** The model's reply text, or the reason there is none. */
async function askModel(
  input: DecideInput,
  key: string,
  system: string,
  user: string,
): Promise<{ text: string } | { why: string }> {
  const send = input.fetch ?? fetch;
  let res: Response;
  try {
    res = await send(MESSAGES_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({
        model: input.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { why: `request failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!res.ok) return { why: `upstream ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}` };
  const message: unknown = await res.json().catch(() => null);
  const text = replyText(message);
  if (!text) return { why: `no reply (stop_reason ${String((message as { stop_reason?: unknown } | null)?.stop_reason)})` };
  return { text };
}

/**
 * The student's next session. The attempts are replayed with the engine and the candidates built from the graph,
 * so nothing the client sends but its attempts and goals is trusted. The model picks 3-5 of the candidates and
 * says why; with no key, an upstream error or a reply that fails the graph check, the plan is the top candidates.
 * Each decision's inputs and outputs are logged.
 */
export async function decideNext(input: DecideInput): Promise<NextSession> {
  const { curriculum, request, now } = input;
  const states = replay(curriculum, request.attempts);
  const candidates = buildCandidates(curriculum, states, request.goals, now);
  const graphIds = new Set(curriculum.nodes.map(n => n.id));
  const log = (session: NextSession, why?: string) => {
    console.info('learn next: decision', {
      attempts: request.attempts.length,
      goals: request.goals.songIds,
      candidates: candidates.map(c => `${c.nodeId}:${c.score}`),
      model: session.source === 'model' ? input.model : null,
      ...(why ? { fallbackBecause: why } : {}),
      activities: session.activities.map(a => `${a.activity}:${a.nodeId}`),
    });
    return session;
  };
  const fallback = (why: string) => log({ activities: fallbackPlan(candidates), source: 'fallback' }, why);

  if (candidates.length === 0) return fallback('no candidates');
  if (!input.key) return fallback('no key');
  const reply = await askModel(input, input.key, SYSTEM_PROMPT, plannerMessage(candidates, request.goals));
  if ('why' in reply) {
    console.error('learn next: the Messages API gave no plan', reply.why);
    return fallback(reply.why);
  }
  const checked = validatePlan(reply.text, candidates, graphIds);
  if (!checked.ok) {
    console.error('learn next: the plan failed the graph check', checked.why, reply.text.slice(0, 500));
    return fallback(`rejected: ${checked.why}`);
  }
  return log({ activities: checked.activities, source: 'model' });
}
