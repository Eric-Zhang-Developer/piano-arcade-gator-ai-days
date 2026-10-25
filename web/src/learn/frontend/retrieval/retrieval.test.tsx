import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { theoryGates, type Attempt } from '../theory';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));

const { Retrieval, current, initialRetrieval, retrievalReducer, summary, theoryItems, verdict } = await import('./index');

const text = (html: string) => html.replace(/<[^>]+>/g, '|');
const css = readFileSync(new URL('./retrieval.module.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const answer = (state = initialRetrieval, choiceId: string) =>
  retrievalReducer(retrievalReducer(state, { type: 'select', choiceId }), { type: 'check' });

describe('the questions', () => {
  it('are every gate question in content order, each id once', () => {
    expect(theoryItems.map(i => i.question.id)).toEqual(theoryGates.flatMap(g => g.questions.map(q => q.id)));
    expect(new Set(theoryItems.map(i => i.question.id)).size).toBe(theoryItems.length);
  });
});

describe('retrievalReducer', () => {
  it('checks the picked answer once and records it as the attempt', () => {
    const s = answer(initialRetrieval, 'g');
    expect(s.checked).toBe(true);
    expect(s.attempts).toEqual([{ type: 'answer', gateId: 'home', questionId: 'tonic', choiceId: 'g' }]);
    expect(retrievalReducer(s, { type: 'check' })).toBe(s);
  });
  it('ignores Check with nothing picked, an unknown option, and a new pick after Check', () => {
    expect(retrievalReducer(initialRetrieval, { type: 'check' })).toBe(initialRetrieval);
    expect(retrievalReducer(initialRetrieval, { type: 'select', choiceId: 'nope' })).toBe(initialRetrieval);
    const s = answer(initialRetrieval, 'g');
    expect(retrievalReducer(s, { type: 'select', choiceId: 'c' })).toBe(s);
  });
  it('moves on only after Check, clearing the pick', () => {
    const picked = retrievalReducer(initialRetrieval, { type: 'select', choiceId: 'c' });
    expect(retrievalReducer(picked, { type: 'next' })).toBe(picked);
    const s = retrievalReducer(answer(initialRetrieval, 'c'), { type: 'next' });
    expect(s).toMatchObject({ index: 1, selected: null, checked: false });
    expect(current(s)?.question.id).toBe('tonic-degree');
  });
  it('restarts empty', () => {
    expect(retrievalReducer(answer(initialRetrieval, 'c'), { type: 'restart' })).toBe(initialRetrieval);
  });
});

describe('verdict', () => {
  it('is null before Check, then judges the picked option', () => {
    expect(verdict(retrievalReducer(initialRetrieval, { type: 'select', choiceId: 'c' }))).toBeNull();
    expect(verdict(answer(initialRetrieval, 'c'))).toMatchObject({ correct: true, choice: { id: 'c' } });
    expect(verdict(answer(initialRetrieval, 'f'))).toMatchObject({ correct: false, choice: { id: 'f' } });
  });
});

describe('summary', () => {
  it('counts only the questions answered, by the first answer', () => {
    const attempts: Attempt[] = [
      { type: 'answer', gateId: 'home', questionId: 'tonic', choiceId: 'c' },
      { type: 'answer', gateId: 'home', questionId: 'tonic-degree', choiceId: '5' },
    ];
    const { right, revisit, answered } = summary(attempts);
    expect(right.map(q => q.id)).toEqual(['tonic']);
    expect(revisit.map(q => q.id)).toEqual(['tonic-degree']);
    expect(answered).toBe(2);
    expect(summary([])).toMatchObject({ right: [], revisit: [], answered: 0 });
  });
});

describe('Retrieval', () => {
  it('shows one question, its options and Check, and no reference', () => {
    const html = renderToStaticMarkup(<Retrieval />);
    const t = text(html);
    expect(t).toContain('|Question 1 of 11|');
    expect(t).toContain(theoryItems[0].question.prompt);
    for (const o of ['|C|', '|G|', '|F|']) expect(t).toContain(o);
    expect(t).toContain('|Check|');
    expect(html).not.toMatch(/Reference|Music/);
    expect(html).not.toContain('✕');
  });
  it('shows a wrong answer with ✕ and that option’s explanation, never the right answer', () => {
    const s = answer(retrievalReducer(answer(initialRetrieval, 'c'), { type: 'next' }), '5');
    const t = text(renderToStaticMarkup(<Retrieval initial={s} />));
    expect(t).toContain('|✕|');
    expect(t).toContain('|Wrong|');
    expect(t).toContain('|Scale degree 5 is the dominant: G in C major.|');
    expect(t).not.toContain('The tonic is scale degree 1');
    expect(t).toContain('|Next|');
  });
  it('shows a right answer with the word and no explanation', () => {
    const t = text(renderToStaticMarkup(<Retrieval initial={answer(initialRetrieval, 'c')} />));
    expect(t).toContain('|Correct|');
    expect(t).not.toContain('A major scale is named');
  });
  it('ends with first-try counts and what to revisit, and claims no mastery', () => {
    const attempts: Attempt[] = [
      { type: 'answer', gateId: 'home', questionId: 'tonic', choiceId: 'c' },
      { type: 'answer', gateId: 'home', questionId: 'tonic-degree', choiceId: '5' },
    ];
    const html = renderToStaticMarkup(<Retrieval initial={{ index: theoryItems.length, selected: null, checked: false, attempts }} />);
    const t = text(html);
    expect(t).toContain('|1 of 2 right on the first try|');
    expect(t).toContain('|To revisit|');
    expect(t).toContain('|Which scale degree is the tonic?|');
    expect(html).toContain('href="/learn"');
    expect(html).not.toMatch(/master|mastery|passed|unlocked/i);
  });
});

describe('the look', () => {
  it('has no gradients, shadows, filters, raw colours or italics', () => {
    expect(css).not.toMatch(/gradient|box-shadow|text-shadow|filter|italic/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
  it('is square, has no mobile layout, and sets no font under 16px', () => {
    for (const r of css.matchAll(/border-radius:\s*([^;]+)/g)) expect(r[1].trim()).toBe('0');
    expect(css).not.toMatch(/@media/);
    for (const f of css.matchAll(/font-size:\s*(\d+)px/g)) expect(Number(f[1])).toBeGreaterThanOrEqual(16);
  });
});
