// What the tutor is told: each question's status from the attempts, the focus, and the conversation turns.
import { describe, expect, it } from 'vitest';
import { type Attempt, type ChatRequest, findGate, theoryGates } from '../../../../learn/frontend/theory';
import { systemPrompt, tutorMessages } from './tutor';

const endings = findGate(theoryGates, 'endings')!;
const request = (attempts: Attempt[], questionId?: string): ChatRequest => ({
  gateId: 'endings',
  ...(questionId ? { questionId } : {}),
  attempts,
  history: [{ role: 'student', text: 'Where does it end?' }],
});
const answer = (questionId: string, choiceId: string, gateId = 'endings'): Attempt => ({ type: 'answer', gateId, questionId, choiceId });
const statusOf = (prompt: string, questionId: string) => prompt.split(`Question "${questionId}"`)[1].split('\n')[1].trim();

describe('systemPrompt', () => {
  it('marks a question open after a wrong answer, and lists the attempt', () => {
    const prompt = systemPrompt(endings, request([answer('phrase-1-end', 'c')]));
    expect(statusOf(prompt, 'phrase-1-end')).toBe('Status: open');
    expect(prompt).toContain('1. phrase-1-end: chose "C" (wrong)');
  });

  it('marks a question answered correctly, or revealed', () => {
    const prompt = systemPrompt(
      endings,
      request([answer('phrase-1-end', 'g'), { type: 'reveal', gateId: 'endings', questionId: 'phrase-2-end' }]),
    );
    expect(statusOf(prompt, 'phrase-1-end')).toBe('Status: answered correctly');
    expect(statusOf(prompt, 'phrase-2-end')).toBe('Status: revealed');
    expect(prompt).toContain('2. phrase-2-end: revealed the answer');
  });

  it('leaves out attempts on other gates', () => {
    const prompt = systemPrompt(endings, request([answer('tonic', 'c', 'home')]));
    expect(prompt).toContain('oldest first:\nnone yet');
  });

  it('names the question in focus, or says there is none', () => {
    expect(systemPrompt(endings, request([], 'phrase-2-end'))).toContain('The student is looking at question "phrase-2-end".');
    expect(systemPrompt(endings, request([]))).toContain('The student is not on a particular question.');
  });

  it('never uses an em dash', () => {
    expect(systemPrompt(endings, request([answer('phrase-1-end', 'c')]))).not.toContain('—');
  });
});

describe('tutorMessages', () => {
  it('maps roles and drops tutor lines before the first student message', () => {
    expect(
      tutorMessages([
        { role: 'tutor', text: 'Welcome.' },
        { role: 'student', text: 'Is it C?' },
        { role: 'tutor', text: 'Listen again.' },
        { role: 'student', text: 'G?' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Is it C?' },
      { role: 'assistant', content: 'Listen again.' },
      { role: 'user', content: 'G?' },
    ]);
  });
});
