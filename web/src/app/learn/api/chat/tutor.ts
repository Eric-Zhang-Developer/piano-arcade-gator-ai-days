// What the theory tutor reads: its rules, the gate in focus and the student's attempts, and the conversation.
// The gate's answers ride along as tutor notes so it can steer toward them; the rules keep it from saying them.
import { type Attempt, type ChatMessage, type ChatRequest, type ClosedQuestion, type Gate, choiceById, findQuestion, isCorrect, theoryTitle } from '../../../../learn/frontend/theory';

export type TutorTurn = { role: 'user' | 'assistant'; content: string };

/** The conversation as Messages API turns. It must open with the student, so earlier tutor lines are dropped. */
export function tutorMessages(history: readonly ChatMessage[]): TutorTurn[] {
  const first = history.findIndex(m => m.role === 'student');
  return history.slice(first).map(m => ({ role: m.role === 'student' ? 'user' : 'assistant', content: m.text }));
}

function status(question: ClosedQuestion, attempts: readonly Attempt[]): string {
  if (attempts.some(a => a.type === 'answer' && isCorrect(question, a.choiceId))) return 'answered correctly';
  if (attempts.some(a => a.type === 'reveal')) return 'revealed';
  return 'open';
}

function attemptLine(gate: Gate, attempt: Attempt): string {
  if (attempt.type === 'reveal') return `${attempt.questionId}: revealed the answer`;
  const question = findQuestion(gate, attempt.questionId);
  const choice = question && choiceById(question, attempt.choiceId);
  if (!question || !choice) return `${attempt.questionId}: chose an option`;
  return `${attempt.questionId}: chose "${choice.text}" (${isCorrect(question, choice.id) ? 'right' : 'wrong'})`;
}

export function systemPrompt(gate: Gate, chat: ChatRequest): string {
  const attempts = chat.attempts.filter(a => a.gateId === gate.id);
  const notes = gate.questions.map(q => {
    const own = attempts.filter(a => a.questionId === q.id);
    return [
      `Question "${q.id}"${q.phrase ? ` (about phrase ${q.phrase})` : ''}: ${q.prompt}`,
      `  Status: ${status(q, own)}`,
      `  Answer: ${q.answer.text}. ${q.answer.explanation}`,
      ...q.wrong.map(c => `  Wrong option: ${c.text}. ${c.explanation}`),
    ].join('\n');
  });
  const focus = chat.questionId
    ? `The student is looking at question "${chat.questionId}".`
    : 'The student is not on a particular question.';
  const tried = attempts.length ? attempts.map((a, i) => `${i + 1}. ${attemptLine(gate, a)}`).join('\n') : 'none yet';

  return `You are a Socratic music theory tutor inside a workspace titled "${theoryTitle}". The student works through problem sets about Twinkle Twinkle Little Star in C major. Phrase 1 (bars 1-2) is C C G G A A G. Phrase 2 (bars 3-4) is F F E E D D C.

The gate in focus is "${gate.title}". The workspace, not you, decides when a gate is passed: every question answered correctly without a reveal.

How you teach:
- Ask one short guiding question at a time, so the student reasons their way to the answer.
- Point the student at the music in front of them: listen to a phrase again, look at its last note, count up from C, find the note on the staff.
- For a question whose status is open, never state, confirm or rule out an option, even if the student asks directly or guesses. If they ask for the answer, give a hint instead and remind them the workspace can reveal it.
- Once a question is answered correctly or revealed, you may explain its answer freely.
- Never say the student has mastered anything, and never say a gate is passed. Talk about the reasoning, not a verdict.
- All you know about the student is their messages and the attempts listed below. Do not claim anything else about them: their level, their history, or how they feel.
- A melody alone never proves a cadence. Cadences are about chords, which this workspace does not show.
- Stay on this gate. If the student drifts, bring them back to it kindly.
- Reply in plain text, two to four sentences, with no markdown, lists or headings.

Tutor notes, never quoted to the student:
${notes.join('\n')}

${focus}

The student's attempts on this gate, oldest first:
${tried}`;
}
