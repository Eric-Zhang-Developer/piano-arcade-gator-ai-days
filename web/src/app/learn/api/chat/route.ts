// POST /learn/api/chat: the theory sandbox's tutor. It takes a ChatRequest and answers with a ChatResponse,
// asking the Messages API for the tutor's next line. The key and model are read on the server; with no key
// the route answers 503 not-configured, which the chat shows as such.
import { type ChatResponse, findGate, parseChatRequest, theoryGates } from '../../../../learn/frontend/theory';
import { systemPrompt, tutorMessages } from './tutor';

const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2026-10-21';
const DEFAULT_MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 8000; // the model thinks before it answers; this leaves room
const TIMEOUT_MS = 60_000;
const MAX_BODY_BYTES = 512 * 1024; // every request within CHAT_LIMITS fits even fully escaped; bigger bodies are refused unread

const UNREADABLE = "The tutor couldn't read that message.";
const TOO_LONG = 'That message is too long for the tutor.';
const UNAVAILABLE = "The tutor couldn't answer right now. Try again in a moment.";

const send = (body: ChatResponse, status = 200) => Response.json(body, { status });
const failure = (status: number, message: string) => send({ status: 'error', message }, status);

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

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return send({ status: 'not-configured' }, 503);

  const raw = await readBody(request);
  if (raw === null) return failure(413, TOO_LONG);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failure(400, UNREADABLE);
  }
  const parsed = parseChatRequest(body);
  if (!parsed.ok) return parsed.reason === 'too-large' ? failure(413, TOO_LONG) : failure(400, UNREADABLE);
  const chat = parsed.request;
  const gate = findGate(theoryGates, chat.gateId);
  if (!gate) return failure(400, UNREADABLE);

  let res: Response;
  try {
    res = await fetch(MESSAGES_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION },
      body: JSON.stringify({
        model: process.env.LEARN_CHAT_MODEL?.trim() || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt(gate, chat),
        messages: tutorMessages(chat.history),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error('learn chat: the Messages API request failed', e);
    return failure(502, UNAVAILABLE);
  }
  if (!res.ok) {
    console.error('learn chat: the Messages API answered', res.status, await res.text().catch(() => ''));
    return failure(502, UNAVAILABLE);
  }
  const message: unknown = await res.json().catch(() => null);
  const reply = replyText(message);
  if (!reply) {
    console.error('learn chat: no reply in the Messages API answer', (message as { stop_reason?: unknown } | null)?.stop_reason);
    return failure(502, UNAVAILABLE);
  }
  return send({ status: 'ok', reply });
}
