import { describe, expect, it } from 'vitest';
import { evaluateAnswer, phraseNotes, questions, reviewQuestions, score } from './lesson';

describe('local theory feedback', () => {
  it('checks closed responses without awarding credit to another choice', () => {
    expect(evaluateAnswer(questions[0], 'Phrase 2')).toBe('correct');
    expect(evaluateAnswer(questions[0], 'Phrase 1')).toBe('incorrect');
    expect(evaluateAnswer(reviewQuestions[2], 'Yes')).toBe('incorrect');
    expect(evaluateAnswer(reviewQuestions[2], 'No')).toBe('correct');
  });
  it('compares open explanations rather than manufacturing a semantic grade', () => {
    expect(evaluateAnswer(questions[1], 'Any explanation, even an incorrect one.')).toBe('compare');
  });
});
describe('source-backed phrase selection', () => {
  it('takes the two phrases from the actual cited chart, with local audio timing', () => {
    const first = phraseNotes(1), second = phraseNotes(2);
    expect(first.map(n=>n.id)).toEqual(score.notes.filter(n=>n.beat<8).map(n=>n.id));
    expect(second.map(n=>n.id)).toEqual(score.notes.filter(n=>n.beat>=8 && n.beat<16).map(n=>n.id));
    expect(first[0].beat).toBe(0);
    expect(second[0].beat).toBe(0);
    expect(first.at(-1)?.pitch).toBe(67);
    expect(second.at(-1)?.pitch).toBe(60);
  });
});
