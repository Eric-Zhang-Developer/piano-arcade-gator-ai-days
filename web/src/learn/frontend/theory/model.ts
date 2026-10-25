/** One option of a closed question. Its explanation says why it is right, or what that mistake is. */
export type Choice = { id: string; text: string; explanation: string };
export type Phrase = 1 | 2;
/** A closed question has exactly one answer and at least one wrong option. `phrase` names the excerpt it asks about. */
export type ClosedQuestion = {
  id: string;
  prompt: string;
  phrase?: Phrase;
  answer: Choice;
  wrong: readonly [Choice, ...Choice[]];
};
/** A named problem set. It passes when every question has been answered correctly without a reveal. */
export type Gate = { id: string; title: string; questions: readonly [ClosedQuestion, ...ClosedQuestion[]] };
/** What the student did. Whether an answer was right is derived from the content, never stored. */
export type Attempt =
  | { type: 'answer'; gateId: string; questionId: string; choiceId: string }
  | { type: 'reveal'; gateId: string; questionId: string };

/** Reads an attempt from untrusted JSON (storage or a request body), keeping only its known fields. */
export function parseAttempt(value: unknown): Attempt | null {
  if (typeof value !== 'object' || value === null) return null;
  const { type, gateId, questionId, choiceId } = value as Record<string, unknown>;
  if (typeof gateId !== 'string' || typeof questionId !== 'string') return null;
  if (type === 'reveal') return { type, gateId, questionId };
  if (type === 'answer' && typeof choiceId === 'string') return { type, gateId, questionId, choiceId };
  return null;
}

export function findGate(gates: readonly Gate[], id: string): Gate | undefined {
  return gates.find(g => g.id === id);
}
export function findQuestion(gate: Gate, id: string): ClosedQuestion | undefined {
  return gate.questions.find(q => q.id === id);
}
export function choiceById(question: ClosedQuestion, id: string): Choice | undefined {
  return [question.answer, ...question.wrong].find(c => c.id === id);
}
export function isCorrect(question: ClosedQuestion, choiceId: string): boolean {
  return question.answer.id === choiceId;
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
/** The options in display order: stable for a round, reshuffled when a missed question comes back. */
export function choices(question: ClosedQuestion, round = 0): readonly Choice[] {
  const key = (c: Choice) => hash(`${question.id}:${round}:${c.id}`);
  return [question.answer, ...question.wrong].sort((a, b) => key(a) - key(b));
}
