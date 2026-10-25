import { describe, expect, it } from 'vitest';
import { curriculum } from '../curriculum';
import { parseAttempt } from '../engine';
import type { Verdict } from '../piano/score';
import type { Attempt, Curriculum, Item, Node, PlayingItem, TheoryItem } from '../schema';
import { activeMs, GAP_CAP_MS, nextItem, playingAttempt, shouldStop, theoryAttempt } from './model';

const node = (id: string, layer: Node['layer'], kind: Node['kind'] = 'declarative'): Node => ({
  id,
  region: 'pitch',
  layer,
  kind,
  title: id,
  whyImportant: '',
  sources: [],
});

const choice = (id: string) => ({ id, text: id, explanation: '' });

const theory = (id: string, nodeId: string): TheoryItem => ({
  type: 'theory',
  id,
  nodeId,
  prompt: id,
  answer: { id: 'right', text: 'right', explanation: '' },
  wrong: [choice('a'), choice('b'), choice('c')],
});

const playing = (id: string, nodeId: string): PlayingItem => ({
  type: 'playing',
  id,
  nodeId,
  prompt: id,
  notes: [{ pitch: 60, startBeat: 0, beats: 1, hand: 'right' }],
  bpm: 72,
  pass: { notesInOrder: 1, timingSpreadMs: 80, velocitySpread: 30 },
} as unknown as PlayingItem);

const graph = (nodes: Node[], items: Item[]): Curriculum => ({ nodes, edges: [], items, songs: [] });

const t0 = Date.parse('2026-10-25T10:00:00Z');
const at = (minutes: number) => new Date(t0 + minutes * 60_000);

const right = (item: TheoryItem, minutes: number) => theoryAttempt('learner', item, 'right', at(minutes));
const wrong = (item: TheoryItem, minutes: number) => theoryAttempt('learner', item, 'a', at(minutes));
const played = (item: PlayingItem, pass: boolean, minutes: number) =>
  playingAttempt('learner', item, { pass, measures: { notesInOrder: 1, timingSpreadMs: 20, velocitySpread: 10 }, off: [] } as Verdict, at(minutes));

describe('nextItem', () => {
  it('starts on the first backbone node when every belief is the prior', () => {
    expect(nextItem(curriculum, [])?.id).toBe('pitch-grand-staff-1');
  });

  it('asks backbone nodes before concept and detail ones, wherever they sit in the list', () => {
    const c = graph([node('d', 'detail'), node('c', 'concept'), node('b', 'backbone')], [theory('d-1', 'd'), theory('c-1', 'c'), theory('b-1', 'b')]);
    expect(nextItem(c, [])?.id).toBe('b-1');
    expect(nextItem(c, [wrong(theory('b-1', 'b'), 0)])?.id).toBe('c-1');
  });

  it('picks the node whose belief is nearest 0.5', () => {
    const a1 = theory('a-1', 'a');
    const c = graph([node('a', 'backbone'), node('b', 'backbone')], [a1, theory('a-2', 'a'), theory('b-1', 'b')]);
    // A right answer lifts `a` from 0.1 to about 0.36, nearer 0.5 than `b` still at the prior.
    expect(nextItem(c, [right(a1, 0)])?.id).toBe('a-2');
  });

  it('alternates theory and playing when both kinds are open', () => {
    const a1 = theory('a-1', 'a');
    const p1 = playing('p-1', 'p');
    const c = graph(
      [node('a', 'backbone'), node('b', 'backbone'), node('p', 'backbone', 'procedural')],
      [a1, theory('a-2', 'a'), theory('b-1', 'b'), p1, playing('p-2', 'p')],
    );
    const first = right(a1, 0);
    expect(nextItem(c, [first])?.id).toBe('p-1');
    expect(nextItem(c, [first, played(p1, true, 1)])?.type).toBe('theory');
  });

  it('alternates on the real curriculum too: theory first, then a playing item', () => {
    const first = nextItem(curriculum, []) as TheoryItem;
    const second = nextItem(curriculum, [right(first, 0)]);
    expect(second?.type).toBe('playing');
  });

  it('never repeats an item and leaves skipped ones alone', () => {
    const a1 = theory('a-1', 'a');
    const c = graph([node('a', 'backbone')], [a1, theory('a-2', 'a')]);
    expect(nextItem(c, [right(a1, 0)])?.id).toBe('a-2');
    expect(nextItem(c, [], new Set(['a-1']))?.id).toBe('a-2');
    expect(nextItem(c, [], new Set(['a-1', 'a-2']))).toBeNull();
  });
});

describe('shouldStop', () => {
  const a1 = theory('a-1', 'a');
  const b1 = theory('b-1', 'b');
  const c = graph([node('a', 'backbone'), node('b', 'backbone'), node('x', 'concept')], [a1, theory('a-2', 'a'), b1, theory('b-2', 'b'), theory('x-1', 'x')]);

  it('does not stop a fresh diagnostic, though every prior is below 0.2', () => {
    expect(shouldStop(c, [], t0)).toBe(false);
    expect(shouldStop(curriculum, [], t0)).toBe(false);
  });

  it('stops once every backbone node is below 0.2 or above 0.8', () => {
    expect(shouldStop(c, [wrong(a1, 0)], at(1).getTime())).toBe(false);
    expect(shouldStop(c, [wrong(a1, 0), wrong(b1, 1)], at(2).getTime())).toBe(true);
  });

  it('stops after 15 active minutes', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const wide = graph(ids.map((id) => node(id, 'backbone')), ids.flatMap((id) => [theory(`${id}-1`, id), theory(`${id}-2`, id)]));
    // One right answer each leaves a node near 0.36: open, so only the clock can stop it.
    // Answers 4 minutes apart: 12 minutes, then 2 more since the last.
    const attempts = ids.slice(0, 4).map((id, i) => right(theory(`${id}-1`, id), i * 4));
    expect(activeMs(attempts, at(14).getTime())).toBe(14 * 60_000);
    expect(shouldStop(wide, attempts, at(14).getTime())).toBe(false);
    expect(shouldStop(wide, attempts, at(15).getTime())).toBe(true);
  });

  it('does not count a long break as time spent', () => {
    const attempts = [right(a1, 0), right(b1, 1)];
    const nextDay = at(24 * 60).getTime();
    expect(activeMs(attempts, nextDay)).toBe(60_000 + GAP_CAP_MS);
    expect(shouldStop(c, attempts, nextDay)).toBe(false);
  });

  it('stops when nothing is left to ask', () => {
    const lone = graph([node('a', 'backbone')], [a1]);
    expect(shouldStop(lone, [right(a1, 0)], at(1).getTime())).toBe(true);
  });
});

describe('resume', () => {
  it('picks up at the same item from the stored attempts', () => {
    let attempts: Attempt[] = [];
    for (let i = 0; i < 4; i++) {
      const item = nextItem(curriculum, attempts) as Item;
      attempts = [
        ...attempts,
        item.type === 'theory' ? right(item, i) : played(item, false, i),
      ];
    }
    const stored = JSON.parse(JSON.stringify(attempts)).map(parseAttempt) as Attempt[];
    expect(stored.every(Boolean)).toBe(true);
    expect(nextItem(curriculum, stored)?.id).toBe(nextItem(curriculum, attempts)?.id);
    expect(new Set(attempts.map((a) => a.itemId)).has(nextItem(curriculum, stored)!.id)).toBe(false);
  });

  it('writes diagnostic attempts the engine counts', () => {
    const item = nextItem(curriculum, []) as TheoryItem;
    const attempt = theoryAttempt('learner', item, item.answer.id, at(0));
    expect(attempt).toMatchObject({ mode: 'diagnostic', kind: 'theory', correct: true, cold: true, helpShare: 0, revealed: false, nodeId: item.nodeId });
    expect(attempt.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(parseAttempt(attempt)).toEqual(attempt);
  });
});
