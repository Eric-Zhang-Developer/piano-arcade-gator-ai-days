import { describe, expect, it } from 'vitest';
import { curriculum } from '../mastery/curriculum';
import type { Attempt, NextRequest } from '../mastery/schema';
import { layoutCurriculum, regions } from './layout';
import { placeLabels, presentation, projectGraph } from './projection';
import { activityHref, fetchNext, maxGoals, paint, parseNextSession, shortTitle, tally, toggleGoal } from './student';

const theoryItems = curriculum.items.filter(item => item.type === 'theory');
/** A counting, correct theory attempt on a real curriculum item: cold, no help, not revealed. */
function attempt(itemId: string, index: number, correct = true): Attempt {
  const item = curriculum.items.find(candidate => candidate.id === itemId)!;
  return { id: `${itemId}-${index}`, learnerId: 'local', at: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(), itemId, nodeId: item.nodeId, mode: 'activity', correct, cold: true, helpShare: 0, revealed: false, kind: 'theory', details: { choiceId: 'right' } };
}
const request: NextRequest = { attempts: [], goals: { songIds: [] } };
const nodeId = curriculum.nodes[0].id;
const valid = { source: 'model', activities: [{ nodeId, activity: 'test', keywords: ['steps'], reason: 'You know the names; check them cold.' }] };

describe('paint', () => {
  it('leaves every node unknown with no attempts', () => {
    const colours = paint(curriculum, []);
    expect(colours.size).toBe(curriculum.nodes.length);
    expect(tally(colours)).toEqual({ unknown: curriculum.nodes.length, 'in-progress': 0, mastered: 0 });
  });

  it('colours a node from one counted attempt, and only that node', () => {
    const item = theoryItems[0];
    const counts = tally(paint(curriculum, [attempt(item.id, 0)]));
    expect(counts['in-progress'] + counts.mastered).toBe(1);
    expect(paint(curriculum, [attempt(item.id, 0)]).get(item.nodeId)).not.toBe('unknown');
  });

  it('masters a node after repeated cold successes across its items', () => {
    const byNode = Map.groupBy(theoryItems, item => item.nodeId);
    const [target, items] = [...byNode].find(([, list]) => list.length >= 2)!;
    const attempts = Array.from({ length: 12 }, (_, index) => attempt(items[index % items.length].id, index));
    expect(paint(curriculum, attempts).get(target)).toBe('mastered');
  });

  it('ignores attempts on items the curriculum does not have', () => {
    const stray = { ...attempt(theoryItems[0].id, 0), itemId: 'not-an-item' };
    expect(tally(paint(curriculum, [stray])).unknown).toBe(curriculum.nodes.length);
  });
});

describe('toggleGoal', () => {
  it('adds up to three and refuses a fourth', () => {
    const three = ['a', 'b', 'c'];
    expect(toggleGoal(['a', 'b'], 'c')).toEqual(three);
    expect(toggleGoal(three, 'd')).toBe(three);
    expect(maxGoals).toBe(3);
  });

  it('removes a chosen song', () => {
    expect(toggleGoal(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('parseNextSession', () => {
  it('accepts a plan on curriculum nodes', () => {
    expect(parseNextSession(valid, curriculum)).toEqual(valid);
  });

  it.each([
    ['a bad source', { ...valid, source: 'guess' }],
    ['no activities', { ...valid, activities: [] }],
    ['an unknown node', { ...valid, activities: [{ ...valid.activities[0], nodeId: 'not-a-node' }] }],
    ['an unknown activity', { ...valid, activities: [{ ...valid.activities[0], activity: 'lecture' }] }],
    ['keywords that are not strings', { ...valid, activities: [{ ...valid.activities[0], keywords: [1] }] }],
    ['no object at all', 'plan'],
  ])('rejects %s', (_, value) => {
    expect(parseNextSession(value, curriculum)).toBeNull();
  });
});

describe('fetchNext', () => {
  it('posts the request to /learn/api/next and returns the plan', async () => {
    let seen: [RequestInfo | URL, RequestInit | undefined] | undefined;
    const result = await fetchNext(async (input, init) => { seen = [input, init]; return new Response(JSON.stringify(valid)); }, request, curriculum);
    expect(result).toEqual({ ok: true, session: valid });
    expect(seen?.[0]).toBe('/learn/api/next');
    expect(seen?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(seen?.[1]?.body))).toEqual(request);
  });

  it('is not connected when the route fails, throws or answers nonsense', async () => {
    expect(await fetchNext(async () => new Response('missing', { status: 404 }), request, curriculum)).toEqual({ ok: false });
    expect(await fetchNext(async () => { throw new TypeError('offline'); }, request, curriculum)).toEqual({ ok: false });
    expect(await fetchNext(async () => new Response('{"activities":[]}'), request, curriculum)).toEqual({ ok: false });
  });
});

describe('layoutCurriculum', () => {
  it('places every node under one of the six regions', () => {
    const { points } = layoutCurriculum(curriculum);
    expect(points).toHaveLength(curriculum.nodes.length + regions.length);
    expect(points.filter(point => point.depth === 0).map(point => point.node.id).sort()).toEqual(regions.map(region => `region:${region}`).sort());
    expect(points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it('shows painted nodes before unpainted ones of the same depth', () => {
    const projected = projectGraph(layoutCurriculum(curriculum).points, 1280, 600);
    const deepest = projected.filter(point => point.depth >= 2).at(-1)!;
    expect(presentation(projected, null, 1280, 600).visible.has(deepest.node.id)).toBe(false);
    expect(presentation(projected, null, 1280, 600, new Set([deepest.node.id])).visible.has(deepest.node.id)).toBe(true);
  });
});

describe('projection options', () => {
  const { points } = layoutCurriculum(curriculum);

  it('lifts the graph only into spare vertical room', () => {
    const plain = projectGraph(points, 1280, 900), lifted = projectGraph(points, 1280, 900, 150);
    const shift = lifted[0].screenY - plain[0].screenY;
    expect(shift).toBeGreaterThan(0);
    expect(shift).toBeLessThanOrEqual(150);
    expect(lifted.every((point, index) => point.screenX === plain[index].screenX)).toBe(true);
    expect(Math.max(...lifted.map(point => point.screenY))).toBeLessThanOrEqual(900 - 50 + 0.001);
  });

  it('captions a named node at the overview zoom and no other deep node', () => {
    const projected = projectGraph(points, 1280, 720);
    const deep = projected.filter(point => point.depth >= 2);
    const { visible, preview } = presentation(projected, null, 1280, 720, new Set(deep.map(point => point.node.id)));
    const plain = placeLabels(projected, visible, preview, null, null, 1, 1280, 720);
    expect(plain.every(label => label.root)).toBe(true);
    const named = deep.find(point => visible.has(point.node.id))!;
    const captions = placeLabels(projected, visible, preview, null, null, 1, 1280, 720, new Set([named.node.id]));
    expect(captions.filter(label => !label.root).map(label => label.id)).toEqual([named.node.id]);
  });
});

describe('captions and links', () => {
  it('cuts a title at its first colon or bracket', () => {
    expect(shortTitle('Intervals: the distance between notes')).toBe('Intervals');
    expect(shortTitle('Middle C (C4)')).toBe('Middle C');
    expect(shortTitle('Rests')).toBe('Rests');
  });

  it('links an activity to its screen with the node encoded', () => {
    expect(activityHref({ activity: 'practice', nodeId: 'keys/c major' })).toBe('/learn/practice?node=keys%2Fc%20major');
  });
});
