import { describe, expect, it } from 'vitest';
import type { Attempt, Curriculum, Node, PlayingItem, TheoryItem } from '../schema';
import { CHECK_DAYS, DEFAULT_PRIOR, DEMOTE_BELOW, PROMOTED_BELIEF } from './constants';
import { colourOf, nudgePriors, replay } from './replay';

const node = (id: string, kind: Node['kind'] = 'declarative'): Node => ({
  id,
  region: 'pitch',
  layer: 'concept',
  kind,
  title: id,
  whyImportant: '',
  sources: [],
});
const choice = (id: string) => ({ id, text: id, explanation: '' });
const theory = (id: string, nodeId: string, wrong = 2): TheoryItem => ({
  type: 'theory',
  id,
  nodeId,
  prompt: id,
  answer: choice('right'),
  wrong: [choice('w0'), ...Array.from({ length: wrong - 1 }, (_, i) => choice(`w${i + 1}`))],
});
const playing = (id: string, nodeId: string): PlayingItem => ({
  type: 'playing',
  id,
  nodeId,
  prompt: id,
  notes: [],
  bpm: 80,
  pass: { notesInOrder: 0.9, timingSpreadMs: 40, velocitySpread: 12 },
});

const curriculum: Curriculum = {
  nodes: [node('names'), node('steps'), node('scale', 'procedural'), node('far')],
  edges: [
    { from: 'names', to: 'steps', relation: 'in-context', weight: 5, rationale: '' },
    { from: 'scale', to: 'names', relation: 'analogous', weight: 2, rationale: '' },
  ],
  items: [
    theory('names-1', 'names'),
    theory('names-2', 'names', 1),
    theory('steps-1', 'steps'),
    playing('scale-1', 'scale'),
    playing('scale-2', 'scale'),
  ],
  songs: [],
};

const start = Date.parse('2026-10-01T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;
let seq = 0;
type Opts = Partial<Pick<Attempt, 'correct' | 'helpShare' | 'revealed' | 'mode'>> & { at?: number };
function attempt(itemId: string, { at = start + seq * 60_000, ...o }: Opts = {}): Attempt {
  const item = curriculum.items.find(i => i.id === itemId)!;
  const base = {
    id: `a${String(seq++).padStart(3, '0')}`,
    learnerId: 'me',
    at: new Date(at).toISOString(),
    itemId,
    nodeId: item.nodeId,
    mode: o.mode ?? 'activity',
    correct: o.correct ?? true,
    cold: (o.helpShare ?? 0) === 0,
    helpShare: o.helpShare ?? 0,
    revealed: o.revealed ?? false,
  };
  return item.type === 'theory'
    ? { ...base, kind: 'theory', details: { choiceId: base.correct ? 'right' : 'w0' } }
    : { ...base, kind: 'playing', details: { notesInOrder: 1, timingSpreadMs: 20, velocitySpread: 8 } };
}
const state = (attempts: readonly Attempt[], id: string) => replay(curriculum, attempts).get(id)!;

/** Promotes `scale` with three cold successes on its two playing items. */
const mastered = () => [attempt('scale-1'), attempt('scale-1'), attempt('scale-2')];

describe('replay', () => {
  it('leaves every node unknown at the default prior with no counting attempt', () => {
    const states = replay(curriculum, [attempt('names-1', { revealed: true })]);
    for (const n of curriculum.nodes) {
      const s = states.get(n.id)!;
      expect(s).toEqual({ phase: 'encoding', belief: DEFAULT_PRIOR, counted: 0, itemsSeen: [], nextCheckAt: null });
      expect(colourOf(s)).toBe('unknown');
    }
  });

  it('raises the belief on each cold success and marks the node in progress', () => {
    const attempts = [attempt('names-1')];
    const one = state(attempts, 'names');
    expect(one.belief).toBeGreaterThan(DEFAULT_PRIOR);
    expect(colourOf(one)).toBe('in-progress');
    attempts.push(attempt('names-1'));
    expect(state(attempts, 'names').belief).toBeGreaterThan(one.belief);
  });

  it('lowers the belief on a cold failure in encoding', () => {
    const before = state([attempt('names-1'), attempt('names-1')], 'names');
    const after = state([attempt('names-1'), attempt('names-1'), attempt('names-2', { correct: false })], 'names');
    expect(after.belief).toBeLessThan(before.belief);
    expect(after.phase).toBe('encoding');
  });

  it('promotes at 0.95 only with three counting attempts on two items, and sets the belief to 0.99', () => {
    // Playing items have a low guess, so two successes already pass 0.95.
    const two = state([attempt('scale-1'), attempt('scale-1')], 'scale');
    expect(two.belief).toBeGreaterThanOrEqual(0.95);
    expect(two.phase).toBe('encoding');
    const oneItem = state([attempt('scale-1'), attempt('scale-1'), attempt('scale-1')], 'scale');
    expect(oneItem.phase).toBe('encoding');

    const attempts = mastered();
    const s = state(attempts, 'scale');
    expect(s).toMatchObject({ phase: 'retrieval', belief: PROMOTED_BELIEF, counted: 3 });
    expect(s.itemsSeen).toEqual(['scale-1', 'scale-2']);
    expect(colourOf(s)).toBe('mastered');
  });

  it('needs a belief of 0.95 too: theory items, with a higher guess, take more successes', () => {
    const attempts = [attempt('names-1'), attempt('names-2'), attempt('names-1')];
    expect(state(attempts, 'names')).toMatchObject({ phase: 'encoding', counted: 3 });
    while (state(attempts, 'names').phase === 'encoding') attempts.push(attempt('names-2'));
    expect(state(attempts, 'names').belief).toBe(PROMOTED_BELIEF);
  });

  it('ignores an attempt with more than 30% help or a revealed hint', () => {
    const base = [attempt('scale-1')];
    const before = state(base, 'scale');
    for (const extra of [
      attempt('scale-2', { helpShare: 0.31 }),
      attempt('scale-2', { helpShare: 0.31, correct: false }),
      attempt('scale-2', { revealed: true }),
      attempt('names-1', { revealed: true, mode: 'diagnostic' }),
    ]) {
      expect(replay(curriculum, [...base, extra])).toEqual(replay(curriculum, base));
    }
    expect(state([...base, attempt('scale-2', { helpShare: 0.3 })], 'scale').counted).toBe(before.counted + 1);
  });

  it('ignores attempts whose item is unknown or credits another node', () => {
    const base = [attempt('names-1')];
    const stray = { ...attempt('names-1'), itemId: 'nope' };
    const misfiled = { ...attempt('names-1'), nodeId: 'steps' };
    expect(replay(curriculum, [...base, stray, misfiled])).toEqual(replay(curriculum, base));
  });

  it('keeps a mastered node after one cold failure, and demotes it below 0.6 after two in a row', () => {
    for (const itemId of ['scale-1', 'names-2']) {
      const attempts = itemId === 'scale-1' ? mastered() : [attempt('names-1'), attempt('names-2')];
      while (state(attempts, curriculum.items.find(i => i.id === itemId)!.nodeId).phase === 'encoding') {
        attempts.push(attempt(itemId));
      }
      const nodeId = attempts[0].nodeId;
      attempts.push(attempt(itemId, { correct: false }));
      const once = state(attempts, nodeId);
      expect(once.phase).toBe('retrieval');
      expect(once.belief).toBeGreaterThanOrEqual(DEMOTE_BELOW);

      attempts.push(attempt(itemId, { correct: false }));
      const twice = state(attempts, nodeId);
      expect(twice.belief).toBeLessThan(DEMOTE_BELOW);
      expect(twice).toMatchObject({ phase: 'encoding', nextCheckAt: null });
      expect(colourOf(twice)).toBe('in-progress');
    }
  });

  it('steps checks through 1, 3, 7, 21, 60 days, and back to 1 on a failure', () => {
    const attempts = mastered();
    const promotedAt = Date.parse(attempts[2].at);
    expect(state(attempts, 'scale').nextCheckAt).toBe(new Date(promotedAt + CHECK_DAYS[0] * day).toISOString());

    let at = promotedAt;
    for (const days of [3, 7, 21, 60, 60]) {
      at += 30 * day;
      attempts.push(attempt('scale-1', { at }));
      expect(state(attempts, 'scale').nextCheckAt).toBe(new Date(at + days * day).toISOString());
    }
    at += 30 * day;
    attempts.push(attempt('scale-2', { at, correct: false }));
    expect(state(attempts, 'scale')).toMatchObject({
      phase: 'retrieval',
      nextCheckAt: new Date(at + day).toISOString(),
    });
    at += day;
    attempts.push(attempt('scale-2', { at }));
    expect(state(attempts, 'scale').nextCheckAt).toBe(new Date(at + 3 * day).toISOString());
  });

  it('never lowers a belief for time passing', () => {
    const attempts = mastered();
    const s = state(attempts, 'scale');
    attempts.push({ ...attempt('names-1'), at: new Date(start + 400 * day).toISOString() });
    expect(state(attempts, 'scale')).toEqual(s);
  });

  it('is deterministic: the same attempts in any order replay to the same states', () => {
    const attempts = [
      ...mastered(),
      attempt('names-1', { mode: 'diagnostic' }),
      attempt('steps-1', { correct: false }),
      attempt('scale-1', { correct: false }),
      { ...attempt('names-2'), at: new Date(start).toISOString() },
    ];
    const once = replay(curriculum, attempts);
    expect(replay(curriculum, [...attempts].reverse())).toEqual(once);
    expect(replay(curriculum, [...attempts.slice(3), ...attempts.slice(0, 3)])).toEqual(once);
    expect(replay(curriculum, attempts)).toEqual(once);
  });
});

describe('nudgePriors', () => {
  it('moves only the priors of untouched linked nodes, by edge weight', () => {
    const states = replay(curriculum, [attempt('names-1', { mode: 'diagnostic' })]);
    // weight 5 moves halfway to 0.8; weight 2 a fifth of the way.
    expect(states.get('steps')!.belief).toBeCloseTo(DEFAULT_PRIOR + (0.8 - DEFAULT_PRIOR) * 0.5);
    expect(states.get('scale')!.belief).toBeCloseTo(DEFAULT_PRIOR + (0.8 - DEFAULT_PRIOR) * 0.2);
    expect(states.get('far')!.belief).toBe(DEFAULT_PRIOR);
    for (const id of ['steps', 'scale']) {
      expect(states.get(id)).toMatchObject({ phase: 'encoding', counted: 0, itemsSeen: [], nextCheckAt: null });
      expect(colourOf(states.get(id)!)).toBe('unknown');
    }
  });

  it('pulls toward 0.02 on a failure', () => {
    const states = replay(curriculum, [attempt('names-1', { mode: 'diagnostic', correct: false })]);
    expect(states.get('steps')!.belief).toBeCloseTo(DEFAULT_PRIOR + (0.02 - DEFAULT_PRIOR) * 0.5);
  });

  it('leaves a node that already has evidence alone', () => {
    const states = replay(curriculum, [attempt('steps-1'), attempt('names-1', { mode: 'diagnostic' })]);
    expect(states.get('steps')).toEqual(replay(curriculum, [attempt('steps-1')]).get('steps'));
  });

  it('does not nudge from an activity attempt', () => {
    expect(replay(curriculum, [attempt('names-1')]).get('steps')!.belief).toBe(DEFAULT_PRIOR);
  });

  it('is pure: it returns a new map and leaves the input as it was', () => {
    const states = replay(curriculum, []);
    const copy = new Map(states);
    const next = nudgePriors(curriculum, 'names', true, states);
    expect(next).not.toBe(states);
    expect(states).toEqual(copy);
    expect(next.get('steps')!.belief).toBeGreaterThan(DEFAULT_PRIOR);
  });
});
