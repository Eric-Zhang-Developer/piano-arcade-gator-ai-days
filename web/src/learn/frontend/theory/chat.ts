import { theoryGates } from './content';
import { type Attempt, type Gate, choiceById, findGate, findQuestion, parseAttempt } from './model';

export type StudentMessage = { role: 'student'; text: string };
export type TutorMessage = { role: 'tutor'; text: string };
export type ChatMessage = StudentMessage | TutorMessage;

/** What the theory chat sends: what the student is looking at, what they tried, and the conversation, ending with their new message. */
export type ChatRequest = {
  gateId: string;
  questionId?: string;
  attempts: readonly Attempt[];
  history: readonly [...ChatMessage[], StudentMessage];
};
/** The tutor's reply, or why there is none. The client shows `not-configured` and `error` as such, never as a reply. */
export type ChatResponse = { status: 'ok'; reply: string } | { status: 'not-configured' } | { status: 'error'; message: string };

/** Caps both ends enforce: characters per message, messages per request, attempts per request. */
export const CHAT_LIMITS = { messageChars: 2000, history: 20, attempts: 200 } as const;

/** The request for the student's next message: their latest attempts and messages, within the limits. */
export function chatRequest(
  focus: { gateId: string; questionId?: string },
  attempts: readonly Attempt[],
  history: readonly ChatMessage[],
  text: string,
): ChatRequest {
  return {
    ...focus,
    attempts: attempts.slice(-CHAT_LIMITS.attempts),
    history: [...history.slice(1 - CHAT_LIMITS.history), { role: 'student', text }],
  };
}

export type ParsedChatRequest = { ok: true; request: ChatRequest } | { ok: false; reason: 'invalid' | 'too-large' };

/** Checks a request body at the boundary: known gate and question, real attempts, and a conversation within the limits. */
export function parseChatRequest(body: unknown, gates: readonly Gate[] = theoryGates): ParsedChatRequest {
  const invalid = { ok: false, reason: 'invalid' } as const;
  const tooLarge = { ok: false, reason: 'too-large' } as const;
  if (typeof body !== 'object' || body === null) return invalid;
  const { gateId, questionId, attempts, history } = body as Record<string, unknown>;
  const gate = typeof gateId === 'string' ? findGate(gates, gateId) : undefined;
  if (!gate) return invalid;
  if (questionId !== undefined && (typeof questionId !== 'string' || !findQuestion(gate, questionId))) return invalid;
  if (!Array.isArray(attempts) || !Array.isArray(history)) return invalid;
  if (attempts.length > CHAT_LIMITS.attempts || history.length > CHAT_LIMITS.history) return tooLarge;

  const parsed: Attempt[] = [];
  for (const value of attempts) {
    const a = parseAttempt(value);
    const g = a && findGate(gates, a.gateId);
    const q = g && findQuestion(g, a.questionId);
    if (!a || !q || (a.type === 'answer' && !choiceById(q, a.choiceId))) return invalid;
    parsed.push(a);
  }
  const messages: ChatMessage[] = [];
  for (const value of history) {
    if (typeof value !== 'object' || value === null) return invalid;
    const { role, text } = value as Record<string, unknown>;
    if ((role !== 'student' && role !== 'tutor') || typeof text !== 'string' || !text.trim()) return invalid;
    if (text.length > CHAT_LIMITS.messageChars) return tooLarge;
    messages.push({ role, text });
  }
  const last = messages[messages.length - 1];
  if (last?.role !== 'student') return invalid;
  const request: ChatRequest = { gateId: gate.id, attempts: parsed, history: [...messages.slice(0, -1), last] };
  return { ok: true, request: questionId === undefined ? request : { ...request, questionId } };
}

/** Reads the route's JSON on the client. Anything unexpected is null, which the client shows as not connected. */
export function parseChatResponse(body: unknown): ChatResponse | null {
  if (typeof body !== 'object' || body === null) return null;
  const { status, reply, message } = body as Record<string, unknown>;
  if (status === 'ok' && typeof reply === 'string') return { status, reply };
  if (status === 'not-configured') return { status };
  if (status === 'error' && typeof message === 'string') return { status, message };
  return null;
}
