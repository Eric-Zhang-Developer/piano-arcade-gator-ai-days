import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { curriculum } from '../mastery/curriculum';
import { nodeScreen, theoryGates, type Attempt } from '../theory';

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
    // Next decides what follows, so the test shows no count (decision "Agent drives").
    expect(t).not.toMatch(/Question \d+ of/);
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
    // A checked answer is final, so the options not picked go (decision "Agent drives", seven items or fewer).
    expect(t).toContain('|5|');
    for (const o of ['|1|', '|3|']) expect(t).not.toContain(o);
  });
  it('shows every option until Check', () => {
    const s = retrievalReducer(retrievalReducer(answer(initialRetrieval, 'c'), { type: 'next' }), { type: 'select', choiceId: '5' });
    const t = text(renderToStaticMarkup(<Retrieval initial={s} />));
    for (const o of ['|1|', '|3|', '|5|']) expect(t).toContain(o);
    expect(t).toContain('|Check|');
  });
  it('shows a right answer with the word and no explanation', () => {
    const t = text(renderToStaticMarkup(<Retrieval initial={answer(initialRetrieval, 'c')} />));
    expect(t).toContain('|Correct|');
    expect(t).not.toContain('A major scale is named');
  });
  it('ends with first-try counts and the way back, no revisit list, and claims no mastery', () => {
    const attempts: Attempt[] = [
      { type: 'answer', gateId: 'home', questionId: 'tonic', choiceId: 'c' },
      { type: 'answer', gateId: 'home', questionId: 'tonic-degree', choiceId: '5' },
    ];
    const html = renderToStaticMarkup(<Retrieval initial={{ index: theoryItems.length, selected: null, checked: false, attempts }} />);
    const t = text(html);
    expect(t).toContain('|1 of 2 right on the first try|');
    // Next picks what to revisit, so the end lists nothing to choose from (decision "Agent drives").
    expect(t).not.toContain('To revisit');
    expect(t).not.toContain('Which scale degree is the tonic?');
    expect(t).toContain('|Back to map|');
    expect(html).toContain('href="/learn"');
    expect(html).not.toMatch(/master|mastery|passed|unlocked/i);
  });
  it('ends on the map, with no list when nothing needs revisiting and no restart', () => {
    const attempts: Attempt[] = [{ type: 'answer', gateId: 'home', questionId: 'tonic', choiceId: 'c' }];
    const t = text(renderToStaticMarkup(<Retrieval initial={{ index: theoryItems.length, selected: null, checked: false, attempts }} />));
    expect(t).toContain('|1 of 1 right on the first try|');
    expect(t).not.toContain('To revisit');
    expect(t).not.toMatch(/Try again|Round complete/);
    expect(t).toContain('|Back to map|');
  });
});

describe('Retrieval for a node', () => {
  const node = nodeScreen(curriculum, 'pitch-grand-staff')!;
  it('tests only the node\'s items, with no count', () => {
    const t = text(renderToStaticMarkup(<Retrieval node={node} />));
    expect(t).toContain(`|${node.gate.questions[0].prompt}|`);
    expect(t).toContain('|Check|');
    expect(t).not.toMatch(/Question \d+ of/);
    expect(t).not.toContain(theoryItems[0].question.prompt);
  });
  it('ends with Test done and the way back to the map', () => {
    const t = text(renderToStaticMarkup(<Retrieval node={node} initial={{ index: node.gate.questions.length, selected: null, checked: false, attempts: [] }} />));
    expect(t).toContain('|Test done|');
    expect(t).toContain('|Back to map|');
    expect(t).not.toContain('right on the first try');
  });
  it('says there is nothing to test for a node without theory items', () => {
    const t = text(renderToStaticMarkup(<Retrieval node={null} />));
    expect(t).toContain('|No theory questions for this node|');
    expect(t).not.toContain('|Check|');
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
