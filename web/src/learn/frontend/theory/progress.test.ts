import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Attempt, Gate } from './model';
import { PROGRESS_KEY, type TheoryProgress, allPassed, emptyProgress, firstTry, gateProgress, loadProgress, openGate, progressReducer, saveProgress } from './progress';

const option = (id: string) => ({ id, text: id, explanation: `${id} explained` });
const gate = (id: string, ...questions: string[]): Gate => ({
  id,
  title: id,
  questions: questions.map(q => ({ id: q, prompt: q, answer: option('right'), wrong: [option('wrong')] })) as unknown as Gate['questions'],
});
const gates = [gate('one', 'a', 'b', 'c'), gate('two', 'd', 'e')];
const right = (gateId: string, questionId: string): Attempt => ({ type: 'answer', gateId, questionId, choiceId: 'right' });
const wrong = (gateId: string, questionId: string): Attempt => ({ type: 'answer', gateId, questionId, choiceId: 'wrong' });
const reveal = (gateId: string, questionId: string): Attempt => ({ type: 'reveal', gateId, questionId });
const play = (...attempts: Attempt[]) => attempts.reduce<TheoryProgress>((s, a) => progressReducer(s, a, gates), emptyProgress);
const current = (s: TheoryProgress, g = gates[0]) => {
  const p = gateProgress(g, s.attempts);
  return p.status === 'open' ? `${p.current.id}@${p.round} ${p.passed}/${p.total}` : `passed ${p.total}`;
};

describe('the gate pass rule', () => {
  it('passes once every question is answered correctly', () => {
    expect(current(play())).toBe('a@0 0/3');
    expect(current(play(right('one', 'a'), right('one', 'b')))).toBe('c@0 2/3');
    expect(current(play(right('one', 'a'), right('one', 'b'), right('one', 'c')))).toBe('passed 3');
  });
  it('brings a missed question back after the others, with its options reshuffled', () => {
    const s = play(wrong('one', 'a'), right('one', 'b'));
    expect(current(s)).toBe('c@0 1/3');
    expect(current(play(...s.attempts, right('one', 'c')))).toBe('a@1 2/3');
    expect(current(play(...s.attempts, right('one', 'c'), right('one', 'a')))).toBe('passed 3');
  });
  it('does not pass a revealed question: it comes back too', () => {
    expect(current(play(reveal('one', 'a')))).toBe('b@0 0/3');
    expect(current(play(right('one', 'a'), right('one', 'b'), reveal('one', 'c')))).toBe('c@1 2/3');
    expect(current(play(right('one', 'a'), right('one', 'b'), reveal('one', 'c'), wrong('one', 'c')))).toBe('c@2 2/3');
  });
  it('passes the whole set only when every gate passes', () => {
    const one = [right('one', 'a'), right('one', 'b'), right('one', 'c')];
    expect(openGate(play().attempts, gates)?.id).toBe('one');
    expect(openGate(play(...one).attempts, gates)?.id).toBe('two');
    expect(allPassed(play(...one).attempts, gates)).toBe(false);
    expect(allPassed(play(...one, right('two', 'd'), right('two', 'e')).attempts, gates)).toBe(true);
  });
});

describe('the progress reducer', () => {
  it('ignores attempts that do not fit what the gate is showing', () => {
    const s = play(right('one', 'a'));
    const passed = play(right('two', 'd'), right('two', 'e'));
    expect(progressReducer(s, right('one', 'c'), gates)).toBe(s);
    expect(progressReducer(s, { type: 'answer', gateId: 'one', questionId: 'b', choiceId: 'nope' }, gates)).toBe(s);
    expect(progressReducer(s, right('three', 'a'), gates)).toBe(s);
    expect(progressReducer(passed, right('two', 'd'), gates)).toBe(passed);
  });
  it('lets gates be worked in any order, and resets to nothing', () => {
    expect(current(play(right('two', 'd'), right('one', 'a')))).toBe('b@0 1/3');
    expect(progressReducer(play(right('one', 'a')), { type: 'reset' }, gates)).toBe(emptyProgress);
  });
  it('sorts attempted questions by their first try only', () => {
    const s = play(wrong('one', 'a'), right('one', 'b'), reveal('one', 'c'), right('one', 'a'));
    const { right: firstRight, revisit } = firstTry(s.attempts, gates);
    expect(firstRight.map(q => q.id)).toEqual(['b']);
    expect(revisit.map(q => q.id)).toEqual(['a', 'c']);
    expect(firstTry([], gates)).toEqual({ right: [], revisit: [] });
  });
});

describe('progress saved on this device', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubStorage = (initial?: string) => {
    const store = new Map<string, string>(initial === undefined ? [] : [[PROGRESS_KEY, initial]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    return store;
  };

  it('resumes where the learner stopped', () => {
    const store = stubStorage();
    const s = play(wrong('one', 'a'), right('one', 'b'));
    expect(saveProgress(s)).toBe(true);
    expect(JSON.parse(store.get(PROGRESS_KEY)!)).toEqual({ attempts: s.attempts });
    expect(loadProgress(gates)).toEqual(s);
  });
  it('drops saved attempts that no longer fit the content', () => {
    stubStorage(JSON.stringify({ attempts: [right('one', 'a'), right('one', 'gone'), { type: 'guess' }, right('one', 'b')] }));
    expect(loadProgress(gates).attempts).toEqual([right('one', 'a'), right('one', 'b')]);
  });
  it('starts fresh from nothing saved, corrupt data, or no storage at all', () => {
    stubStorage();
    expect(loadProgress(gates)).toBe(emptyProgress);
    stubStorage('{not json');
    expect(loadProgress(gates)).toBe(emptyProgress);
    stubStorage(JSON.stringify({ attempts: 'many' }));
    expect(loadProgress(gates)).toBe(emptyProgress);
    vi.stubGlobal('localStorage', undefined);
    expect(loadProgress(gates)).toBe(emptyProgress);
    expect(saveProgress(play(right('one', 'a')))).toBe(false);
  });
  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } });
    expect(loadProgress(gates)).toBe(emptyProgress);
    expect(saveProgress(play(right('one', 'a')))).toBe(false);
  });
});
