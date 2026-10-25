import { describe, expect, it } from 'vitest';
import { colourOf, replay } from '../engine';
import { activityOf, activityRoute, buildCandidates } from './candidates';
import { attempt, curriculum, day, masterScale, start } from './fixtures';

const both = { songIds: ['song-a', 'song-b'] };
const none = { songIds: [] };
const soon = new Date(start + 200_000);

describe('buildCandidates', () => {
  it('masters scale with the fixture attempts', () => {
    expect(colourOf(replay(curriculum, masterScale()).get('scale')!)).toBe('mastered');
  });

  it('offers unknown nodes linked to a mastered one, scored by layer, link strength and goal value', () => {
    const got = buildCandidates(curriculum, replay(curriculum, masterScale()), both, soon);
    expect(got.map(c => [c.nodeId, c.score])).toEqual([
      ['chords', 6.4],
      ['steps', 4],
      ['keys', 3.8],
      ['octave', 2.6],
    ]);
    expect(got.every(c => c.isNew && !c.due)).toBe(true);
  });

  it('drops goal value when there are no goals', () => {
    const got = buildCandidates(curriculum, replay(curriculum, masterScale()), none, soon);
    expect(got.map(c => [c.nodeId, c.score])).toEqual([
      ['keys', 3.8],
      ['octave', 2.6],
      ['chords', 2.4],
      ['steps', 2],
    ]);
  });

  it('keeps an encoding node linked to a mastered one, and not a node linked to nothing mastered', () => {
    const attempts = [...masterScale(), attempt('rhythm-1', { at: start + 180_000 }), attempt('keys-1', { at: start + 190_000 })];
    const got = buildCandidates(curriculum, replay(curriculum, attempts), none, soon);
    const keys = got.find(c => c.nodeId === 'keys')!;
    expect(keys).toMatchObject({ colour: 'in-progress', isNew: false, counted: 1, activity: 'sandbox' });
    expect(got.map(c => c.nodeId)).not.toContain('rhythm');
    expect(got.map(c => c.nodeId)).not.toContain('far');
  });

  it('adds a mastered node once its cold check is due, ahead of the rest', () => {
    const states = replay(curriculum, masterScale());
    const before = buildCandidates(curriculum, states, none, new Date(start + 120_000 + day - 1));
    expect(before.map(c => c.nodeId)).not.toContain('scale');
    const after = buildCandidates(curriculum, states, none, new Date(start + 120_000 + day));
    expect(after[0]).toMatchObject({ nodeId: 'scale', due: true, score: 7, activity: 'playCheck' });
    expect(after[0].reason).toBe("T-scale is due for a cold check, so it doesn't slip.");
  });

  it('gives each candidate its keywords, activity and reason', () => {
    const got = buildCandidates(curriculum, replay(curriculum, masterScale()), both, soon);
    const by = new Map(got.map(c => [c.nodeId, c]));
    expect(by.get('steps')!.keywords).toEqual(['steps', 'scale', 'rhythm']);
    expect(by.get('keys')!.keywords).toEqual(['keys', 'chords']);
    expect(by.get('chords')!.keywords).toEqual(['chords', 'keys']);
    expect(by.get('chords')!.activity).toBe('practice');
    expect(by.get('keys')!.activity).toBe('sandbox');
    expect(by.get('steps')!.reason).toBe('T-steps builds on T-scale, which you have mastered. A goal song needs it.');
    expect(by.get('chords')!.reason).toBe('T-chords builds on T-scale, which you have mastered. 2 goal songs need it.');
    expect(by.get('chords')!.goalSongs).toEqual(['song-a', 'song-b']);
  });

  it('starts from the backbone when nothing is mastered', () => {
    const got = buildCandidates(curriculum, replay(curriculum, []), none, soon);
    expect(got.map(c => [c.nodeId, c.score])).toEqual([
      ['far', 3],
      ['keys', 3],
    ]);
    expect(got[0].reason).toBe('T-far is a core idea to start from.');
  });
});

describe('activityOf', () => {
  it('maps each quadrant to its activity', () => {
    expect(activityOf('declarative', 'encoding')).toBe('sandbox');
    expect(activityOf('declarative', 'retrieval')).toBe('test');
    expect(activityOf('procedural', 'encoding')).toBe('practice');
    expect(activityOf('procedural', 'retrieval')).toBe('playCheck');
  });

  it('routes each activity to its page', () => {
    expect(activityRoute('sandbox', 'a b')).toBe('/learn/understand?node=a%20b');
    expect(activityRoute('test', 'x')).toBe('/learn/review/theory?node=x');
    expect(activityRoute('practice', 'x')).toBe('/learn/practice?node=x');
    expect(activityRoute('playCheck', 'x')).toBe('/learn/check?node=x');
  });
});
