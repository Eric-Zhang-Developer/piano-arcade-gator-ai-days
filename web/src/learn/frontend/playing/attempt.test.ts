import { describe, expect, it } from 'vitest';
import { counts } from '../mastery/engine';
import { curriculum } from '../mastery/curriculum';
import type { PlayingItem } from '../mastery/schema';
import { handsOf, keyName, missedNotes, notesFor, passageBeats, playingAttempt, playingNode } from './attempt';

const findKeys = playingNode(curriculum, 'pitch.find-keys')!;
const together = playingNode(curriculum, 'rhythm.play-hands-together')!;
const verdict = { pass: true, measures: { notesInOrder: 1, timingSpreadMs: 20, velocitySpread: 8 }, off: [] };

describe('a node to play', () => {
  it('is a procedural node with its playing items', () => {
    expect(findKeys.node).toEqual({ id: 'pitch.find-keys', title: expect.any(String) });
    expect(findKeys.items.map((i) => i.id)).toEqual(['pitch.find-keys-1', 'pitch.find-keys-2']);
  });
  it('is null for an unknown node, and for one that is not played', () => {
    expect(playingNode(curriculum, 'no.such-node')).toBeNull();
    const item = findKeys.items[0];
    const declarative = { nodes: [{ ...curriculum.nodes.find((n) => n.id === 'pitch.find-keys')!, kind: 'declarative' as const }], items: [item] };
    expect(playingNode(declarative, 'pitch.find-keys')).toBeNull();
  });
});

describe('a passage', () => {
  const item: PlayingItem = { ...findKeys.items[0], notes: [
    { pitch: 60, startBeat: 0, beats: 1, hand: 'right' },
    { pitch: 48, startBeat: 1, beats: 2.5, hand: 'left' },
  ] };
  it('ends where its last note ends', () => expect(passageBeats(item.notes)).toBe(3.5));
  it('names its hands, right first', () => {
    expect(handsOf(item)).toEqual(['right', 'left']);
    expect(handsOf(findKeys.items[0])).toEqual(['right']);
    expect(handsOf(together.items[0])).toEqual(['right', 'left']);
  });
  it('marks the notes no press answered', () => {
    const [c, low] = item.notes;
    expect([...missedNotes(item.notes, [{ pitch: 60, from: .2 }, { pitch: 48, from: 1.6 }])]).toEqual([low]);
    expect([...missedNotes(item.notes, [{ pitch: 62, from: 0 }, { pitch: 48, from: 1.4 }])]).toEqual([c]);
  });
  it('plays one hand when practising hands separate', () => {
    expect(notesFor(item, 'both')).toBe(item.notes);
    expect(notesFor(item, 'left').map((n) => n.pitch)).toEqual([48]);
  });
});

describe('a take becomes an attempt', () => {
  const item = findKeys.items[0];
  const attempt = (helpShare: number) => playingAttempt({ learnerId: 'local', item, verdict, helpShare, id: 'a1', at: '2026-10-25T08:00:00.000Z' });
  it('is a playing activity for this learner, item and node', () => {
    expect(attempt(0)).toMatchObject({ id: 'a1', learnerId: 'local', itemId: item.id, nodeId: 'pitch.find-keys', mode: 'activity', kind: 'playing', correct: true, revealed: false, details: verdict.measures });
  });
  it('is cold only with no help, and counts with at most 30% help', () => {
    expect(attempt(0)).toMatchObject({ cold: true, helpShare: 0 });
    expect(attempt(.3)).toMatchObject({ cold: false, helpShare: .3 });
    expect(counts(attempt(.3))).toBe(true);
    expect(counts(attempt(.31))).toBe(false);
  });
});

it('names keys with middle C as C4', () => {
  expect(keyName(60)).toBe('C4');
  expect(keyName(61)).toBe('C♯4');
  expect(keyName(70)).toBe('B♭4');
  expect(keyName(48)).toBe('C3');
});
