import { describe, expect, it } from 'vitest';
import { replay } from '../engine';
import { buildCandidates } from './candidates';
import { curriculum, masterScale, start } from './fixtures';
import { validatePlan } from './validate';

// Four new candidates: chords, steps, keys and octave, all linked to the mastered scale.
const candidates = buildCandidates(
  curriculum,
  replay(curriculum, masterScale()),
  { songIds: ['song-a', 'song-b'] },
  new Date(start + 200_000),
);
const graphIds = new Set(curriculum.nodes.map(n => n.id));
const pick = (nodeId: string, keywords: unknown = [nodeId], reason: unknown = `Practise ${nodeId}.`) => ({
  nodeId,
  keywords,
  reason,
});
const plan = (...activities: unknown[]) => JSON.stringify({ activities });
const check = (text: string) => validatePlan(text, candidates, graphIds);

describe('validatePlan', () => {
  it('accepts a plan in a code fence and takes each activity from the node, not the model', () => {
    const text = [
      'Here is the plan.',
      '```json',
      JSON.stringify({
        activities: [
          { ...pick('chords', ['chords', 'scale', 'chords']), activity: 'test' },
          pick('steps', ['steps', 'scale', 'rhythm'], '  Steps build on the scale.  '),
          pick('keys', ['keys', 'chords']),
        ],
      }),
      '```',
    ].join('\n');
    const got = check(text);
    expect(got).toEqual({
      ok: true,
      activities: [
        { nodeId: 'chords', activity: 'practice', keywords: ['chords', 'scale'], reason: 'Practise chords.' },
        { nodeId: 'steps', activity: 'sandbox', keywords: ['steps', 'scale', 'rhythm'], reason: 'Steps build on the scale.' },
        { nodeId: 'keys', activity: 'sandbox', keywords: ['keys', 'chords'], reason: 'Practise keys.' },
      ],
    });
  });

  it('rejects a node that is not a candidate, even one in the graph', () => {
    expect(check(plan(pick('chords'), pick('steps'), pick('far')))).toEqual({ ok: false, why: 'off-list node far' });
    expect(check(plan(pick('chords'), pick('steps'), pick('nope')))).toEqual({ ok: false, why: 'off-list node nope' });
  });

  it('rejects more than three new nodes', () => {
    const got = check(plan(pick('chords'), pick('steps'), pick('keys'), pick('octave')));
    expect(got).toEqual({ ok: false, why: 'more than 3 new nodes' });
  });

  it('rejects keywords that are not graph nodes', () => {
    expect(check(plan(pick('chords', ['chords', 'harmony']), pick('steps'), pick('keys')))).toEqual({
      ok: false,
      why: 'keywords for chords are not graph nodes',
    });
    expect(check(plan(pick('chords', []), pick('steps'), pick('keys'))).ok).toBe(false);
    expect(check(plan(pick('chords', ['chords', 'scale', 'keys', 'steps', 'rhythm']), pick('steps'), pick('keys'))).ok).toBe(
      false,
    );
    expect(check(plan(pick('chords', 'chords'), pick('steps'), pick('keys'))).ok).toBe(false);
  });

  it('rejects the wrong number of activities, a repeated node, a missing reason and a reply with no plan', () => {
    expect(check(plan(pick('chords'), pick('steps')))).toEqual({ ok: false, why: '2 activities, wanted 3-4' });
    expect(check(plan(pick('chords'), pick('chords'), pick('steps')))).toEqual({ ok: false, why: 'chords twice' });
    expect(check(plan(pick('chords'), pick('steps'), pick('keys', ['keys'], ' ')))).toEqual({
      ok: false,
      why: 'no usable reason for keys',
    });
    expect(check(plan(pick('chords'), pick('steps'), pick('keys', ['keys'], 'x'.repeat(401)))).ok).toBe(false);
    expect(check(plan(pick('chords'), 'steps', pick('keys')))).toEqual({ ok: false, why: 'an activity is not an object' });
    expect(check('I would start with chords.')).toEqual({ ok: false, why: 'no activities list' });
    expect(check('{"activities": [')).toEqual({ ok: false, why: 'no activities list' });
  });

  it('asks for fewer activities when there are fewer candidates', () => {
    const two = candidates.slice(0, 2);
    expect(validatePlan(plan(pick('chords'), pick('steps')), two, graphIds).ok).toBe(true);
    expect(validatePlan(plan(pick('chords')), two, graphIds)).toEqual({ ok: false, why: '1 activities, wanted 2-2' });
  });
});
