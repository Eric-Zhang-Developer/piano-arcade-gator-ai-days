import { describe, expect, it } from 'vitest';
import { buildCandidates } from '../mastery/decide';
import { attempt, curriculum, masterScale, start } from '../mastery/decide/fixtures';
import { counts, replay } from '../mastery/engine';
import type { Attempt } from './model';
import { exploreNodes, masteryAttempt, nodeGate, nodeScreen } from './node';

const gate = nodeGate(curriculum, 'keys')!;
const question = gate.questions[0];
const record = (choiceId: string, earlier: readonly Attempt[] = []) =>
  masteryAttempt({ id: 'a1', at: new Date(start).toISOString(), nodeId: 'keys', question, choiceId, earlier });

describe('a node as a gate', () => {
  it('holds exactly the node\'s theory items, under its title', () => {
    expect(gate).toMatchObject({ id: 'keys', title: 'T-keys' });
    expect(gate.questions.map(q => q.id)).toEqual(['keys-1']);
  });
  it('is null for an unknown node or one with only playing items', () => {
    expect(nodeGate(curriculum, 'nope')).toBeNull();
    expect(nodeGate(curriculum, 'scale')).toBeNull();
  });
});

describe('the attempt a checked answer appends', () => {
  it('credits the question\'s item and node for the local learner', () => {
    expect(record('right')).toEqual({
      id: 'a1', learnerId: 'local', at: '2026-10-01T12:00:00.000Z', itemId: 'keys-1', nodeId: 'keys', mode: 'activity',
      correct: true, cold: true, helpShare: 0, revealed: false, kind: 'theory', details: { choiceId: 'right' },
    });
    expect(record('w0').correct).toBe(false);
    expect(counts(record('right'))).toBe(true);
  });
  it('is not cold after an earlier try at the same question, and not counted after a reveal', () => {
    const missed = record('right', [{ type: 'answer', gateId: 'keys', questionId: 'keys-1', choiceId: 'w0' }]);
    expect(missed).toMatchObject({ cold: false, revealed: false });
    const revealed = record('right', [{ type: 'reveal', gateId: 'keys', questionId: 'keys-1' }]);
    expect(revealed).toMatchObject({ cold: false, revealed: true });
    expect(counts(revealed)).toBe(false);
  });
  it('ignores tries at other questions', () => {
    expect(record('right', [{ type: 'reveal', gateId: 'keys', questionId: 'other' }])).toMatchObject({ cold: true, revealed: false });
  });
});

describe('the nodes to explore', () => {
  const histories = { nothing: [], 'scale mastered': [...masterScale(), attempt('octave-1')] };
  it.each(Object.entries(histories))('are Next\'s keywords for every candidate, with %s', (_, attempts) => {
    const candidates = buildCandidates(curriculum, replay(curriculum, attempts), { songIds: [] }, new Date(start));
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) expect(exploreNodes(curriculum, c.nodeId, attempts).map(n => n.id)).toEqual(c.keywords);
  });
  it('leave out linked nodes the student has touched', () => {
    expect(exploreNodes(curriculum, 'keys', []).map(n => n.id)).toEqual(['keys', 'scale', 'chords']);
    expect(exploreNodes(curriculum, 'keys', masterScale()).map(n => n.id)).toEqual(['keys', 'chords']);
  });
  it('are empty for an unknown node', () => {
    expect(exploreNodes(curriculum, 'nope', [])).toEqual([]);
  });
});

describe('a node\'s screen', () => {
  it('carries the gate and only the graph around the node, which picks the same keywords', () => {
    const screen = nodeScreen(curriculum, 'keys')!;
    expect(screen.gate).toEqual(gate);
    expect(screen.around.edges.every(e => e.from === 'keys' || e.to === 'keys')).toBe(true);
    expect(screen.around.nodes.length).toBeLessThan(curriculum.nodes.length);
    expect(screen.around.items.every(i => screen.around.nodes.some(n => n.id === i.nodeId))).toBe(true);
    const attempts = [...masterScale(), attempt('octave-1')];
    for (const id of ['keys', 'steps']) {
      const around = nodeScreen(curriculum, id)!.around;
      expect(exploreNodes(around, id, attempts)).toEqual(exploreNodes(curriculum, id, attempts));
    }
  });
  it('is null without a gate', () => {
    expect(nodeScreen(curriculum, 'scale')).toBeNull();
  });
});
