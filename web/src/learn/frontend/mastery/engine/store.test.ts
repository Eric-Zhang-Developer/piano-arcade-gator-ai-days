import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Attempt } from '../schema';
import { ATTEMPTS_KEY, deviceStore, GOALS_KEY, parseAttempt } from './store';

const theory = (id: string, learnerId = 'me'): Attempt => ({
  id,
  learnerId,
  at: '2026-10-01T12:00:00.000Z',
  itemId: 'names-1',
  nodeId: 'names',
  mode: 'activity',
  correct: true,
  cold: true,
  helpShare: 0,
  revealed: false,
  kind: 'theory',
  details: { choiceId: 'right' },
});
const playing: Attempt = {
  ...theory('p1'),
  itemId: 'scale-1',
  nodeId: 'scale',
  helpShare: 0.2,
  cold: false,
  kind: 'playing',
  details: { notesInOrder: 0.95, timingSpreadMs: 30, velocitySpread: 10, legato: 0.8 },
};

describe('parseAttempt', () => {
  it('keeps a valid attempt of either kind as it was', () => {
    expect(parseAttempt(theory('a'))).toEqual(theory('a'));
    expect(parseAttempt(JSON.parse(JSON.stringify(playing)))).toEqual(playing);
  });
  it('drops unknown fields', () => {
    expect(parseAttempt({ ...theory('a'), extra: 1, details: { choiceId: 'right', extra: 2 } })).toEqual(theory('a'));
  });
  it('rejects anything malformed', () => {
    for (const bad of [
      null,
      'attempt',
      { ...theory('a'), at: 'yesterday' },
      { ...theory('a'), mode: 'practice' },
      { ...theory('a'), helpShare: 1.5 },
      { ...theory('a'), helpShare: Number.NaN },
      { ...theory('a'), correct: 'yes' },
      { ...theory('a'), kind: 'guess' },
      { ...theory('a'), details: {} },
      { ...playing, details: { notesInOrder: 1, timingSpreadMs: 20 } },
      { ...playing, details: { ...playing.details, pedal: 'down' } },
    ]) {
      expect(parseAttempt(bad)).toBeNull();
    }
  });
});

describe('the device store', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stubStorage = (initial: Record<string, string> = {}) => {
    const store = new Map(Object.entries(initial));
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    return store;
  };

  it('appends attempts and lists them back for their learner only', async () => {
    const store = stubStorage();
    expect(await deviceStore.append(theory('a'))).toBe(true);
    expect(await deviceStore.append(playing)).toBe(true);
    expect(await deviceStore.append(theory('b', 'you'))).toBe(true);
    expect(await deviceStore.list('me')).toEqual([theory('a'), playing]);
    expect(await deviceStore.list('you')).toEqual([theory('b', 'you')]);
    expect(JSON.parse(store.get(ATTEMPTS_KEY)!)).toHaveLength(3);
  });

  it('stores a retried attempt once', async () => {
    stubStorage();
    await deviceStore.append(theory('a'));
    expect(await deviceStore.append({ ...theory('a'), correct: false })).toBe(true);
    expect(await deviceStore.list('me')).toEqual([theory('a')]);
  });

  it('skips stored attempts that are malformed and keeps the rest', async () => {
    stubStorage({ [ATTEMPTS_KEY]: JSON.stringify([theory('a'), { id: 'x' }, theory('b')]) });
    expect(await deviceStore.list('me')).toEqual([theory('a'), theory('b')]);
  });

  it('keeps goals per learner, with none to start', async () => {
    const store = stubStorage();
    expect(await deviceStore.getGoals('me')).toEqual({ songIds: [] });
    expect(await deviceStore.setGoals('me', { songIds: ['ode'] })).toBe(true);
    expect(await deviceStore.setGoals('you', { songIds: ['minuet', 'canon'] })).toBe(true);
    expect(await deviceStore.getGoals('me')).toEqual({ songIds: ['ode'] });
    expect(await deviceStore.getGoals('you')).toEqual({ songIds: ['minuet', 'canon'] });
    store.set(GOALS_KEY, JSON.stringify({ me: { songIds: [1] } }));
    expect(await deviceStore.getGoals('me')).toEqual({ songIds: [] });
  });

  it('reads as empty from corrupt data or no storage, and reports writes it could not make', async () => {
    stubStorage({ [ATTEMPTS_KEY]: '{not json', [GOALS_KEY]: '[]' });
    expect(await deviceStore.list('me')).toEqual([]);
    expect(await deviceStore.getGoals('me')).toEqual({ songIds: [] });
    vi.stubGlobal('localStorage', undefined);
    expect(await deviceStore.list('me')).toEqual([]);
    expect(await deviceStore.append(theory('a'))).toBe(false);
    expect(await deviceStore.setGoals('me', { songIds: [] })).toBe(false);
  });

  it('survives storage that throws', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } });
    expect(await deviceStore.list('me')).toEqual([]);
    expect(await deviceStore.getGoals('me')).toEqual({ songIds: [] });
    expect(await deviceStore.append(theory('a'))).toBe(false);
    expect(await deviceStore.setGoals('me', { songIds: ['ode'] })).toBe(false);
  });
});
