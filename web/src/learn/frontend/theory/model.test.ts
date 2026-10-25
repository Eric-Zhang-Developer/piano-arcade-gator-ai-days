import { describe, expect, it } from 'vitest';
import { type ClosedQuestion, choiceById, choices, isCorrect, parseAttempt } from './model';

const question: ClosedQuestion = {
  id: 'q',
  prompt: 'Which note?',
  answer: { id: 'c', text: 'C', explanation: 'Right.' },
  wrong: [
    { id: 'g', text: 'G', explanation: 'Not G.' },
    { id: 'f', text: 'F', explanation: 'Not F.' },
  ],
};

describe('attempts read from untrusted JSON', () => {
  it('keeps an answer or a reveal, and only its known fields', () => {
    expect(parseAttempt({ type: 'answer', gateId: 'a', questionId: 'b', choiceId: 'c', correct: true })).toEqual({ type: 'answer', gateId: 'a', questionId: 'b', choiceId: 'c' });
    expect(parseAttempt({ type: 'reveal', gateId: 'a', questionId: 'b', choiceId: 'c' })).toEqual({ type: 'reveal', gateId: 'a', questionId: 'b' });
  });
  it('rejects anything else', () => {
    for (const value of [null, 'answer', 3, [], { type: 'answer', gateId: 'a', questionId: 'b' }, { type: 'skip', gateId: 'a', questionId: 'b' }, { type: 'reveal', gateId: 1, questionId: 'b' }]) {
      expect(parseAttempt(value)).toBeNull();
    }
  });
});

describe('a closed question', () => {
  it('has one correct option, found by id', () => {
    expect(isCorrect(question, 'c')).toBe(true);
    expect(isCorrect(question, 'g')).toBe(false);
    expect(choiceById(question, 'f')?.explanation).toBe('Not F.');
    expect(choiceById(question, 'x')).toBeUndefined();
  });
  it('shows every option once, in an order that holds for a round', () => {
    expect(choices(question).map(c => c.id).sort()).toEqual(['c', 'f', 'g']);
    expect(choices(question, 2)).toEqual(choices(question, 2));
  });
});
