import { describe, expect, it } from 'vitest';
import { phraseNotes } from '../lesson';
import { theoryGates, theoryTitle } from './content';
import { choiceById, choices, findQuestion } from './model';

const questions = theoryGates.flatMap(g => g.questions);
const unique = (ids: string[]) => new Set(ids).size === ids.length;
const name = (midi: number) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12];

describe('the authored gate set', () => {
  it('is 2-3 gates of 3-4 questions, with unique ids', () => {
    expect(theoryGates.length).toBeGreaterThanOrEqual(2);
    expect(theoryGates.length).toBeLessThanOrEqual(3);
    for (const gate of theoryGates) {
      expect(gate.questions.length).toBeGreaterThanOrEqual(3);
      expect(gate.questions.length).toBeLessThanOrEqual(4);
    }
    expect(unique(theoryGates.map(g => g.id))).toBe(true);
    expect(unique(questions.map(q => q.id))).toBe(true);
    for (const q of questions) expect(unique([q.answer, ...q.wrong].map(c => c.id))).toBe(true);
  });
  it('explains every option, and never says mastered or uses an em dash', () => {
    const copy = [theoryTitle, ...theoryGates.flatMap(g => [g.title, ...g.questions.flatMap(q => [q.prompt, ...[q.answer, ...q.wrong].flatMap(c => [c.text, c.explanation])])])];
    for (const text of copy) {
      expect(text.trim()).not.toBe('');
      expect(text).not.toMatch(/master/i);
      expect(text).not.toContain('\u2014');
    }
  });
  it('matches the Twinkle chart it asks about', () => {
    const last = (phrase: 1 | 2) => name(phraseNotes(phrase).at(-1)!.pitch);
    const endings = theoryGates.find(g => g.id === 'endings')!;
    expect(findQuestion(endings, 'phrase-1-end')?.answer.text).toBe(last(1));
    expect(findQuestion(endings, 'phrase-2-end')?.answer.text).toBe(last(2));
    expect(phraseNotes(2).map(n => name(n.pitch))).toEqual(['F', 'F', 'E', 'E', 'D', 'D', 'C']);
    expect(choiceById(findQuestion(endings, 'descent')!, 'steps')).toBe(findQuestion(endings, 'descent')!.answer);
  });
  it('does not always put the answer first, and reshuffles some questions when they come back', () => {
    expect(questions.some(q => choices(q)[0].id !== q.answer.id)).toBe(true);
    expect(questions.some(q => choices(q, 0).map(c => c.id).join() !== choices(q, 1).map(c => c.id).join())).toBe(true);
  });
});
