import { describe, expect, it } from 'vitest';
import type { Candidate } from './candidates';
import { fallbackPlan } from './fallback';

const candidate = (nodeId: string, isNew: boolean): Candidate => ({
  nodeId,
  title: `T-${nodeId}`,
  layer: 'concept',
  kind: 'declarative',
  colour: isNew ? 'unknown' : 'in-progress',
  activity: 'sandbox',
  due: false,
  isNew,
  belief: 0.5,
  counted: isNew ? 0 : 1,
  nextCheckAt: null,
  masteredLinks: [],
  goalSongs: [],
  keywords: [nodeId],
  score: 1,
  reason: `${nodeId} is next.`,
});

describe('fallbackPlan', () => {
  it('takes the top candidates in order, at most five', () => {
    const got = fallbackPlan(['a', 'b', 'c', 'd', 'e', 'f'].map(id => candidate(id, false)));
    expect(got.map(a => a.nodeId)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(got[0]).toEqual({ nodeId: 'a', activity: 'sandbox', keywords: ['a'], reason: 'a is next.' });
  });

  it('skips new nodes past the third', () => {
    const list = [
      candidate('n1', true),
      candidate('n2', true),
      candidate('n3', true),
      candidate('n4', true),
      candidate('old', false),
      candidate('n5', true),
    ];
    expect(fallbackPlan(list).map(a => a.nodeId)).toEqual(['n1', 'n2', 'n3', 'old']);
  });

  it('plans nothing with no candidates', () => {
    expect(fallbackPlan([])).toEqual([]);
  });
});
