import { describe, expect, it } from 'vitest';
import { actionFor, byId, demoGoal, demoLearner, recommendation, rootRelationships, skills } from './data';
import { activityCamera, cameraAt } from './camera';
import { layoutGraph, neighbor } from './layout';
import { anchorLabels, followLabels, overviewCamera, viewPoints, mapSize, placeLabels, presentation, projectGraph } from './projection';

describe('demo graph activity choices', () => {
  it('selects goal-related reachable activities that match available lesson content', () => {
    expect(recommendation('theory')?.id).toBe('theory.phrase-endings');
    expect(recommendation('procedure')?.id).toBe('procedure.short-phrase-coordination');
    for (const domain of ['theory', 'procedure'] as const) {
      const node = recommendation(domain)!;
      expect(demoGoal.targets).toContain(node.id);
      expect(actionFor(node).action).toEqual({ domain, skillId: node.id, intent: 'learn' });
    }
  });
  it('keeps review due separate from mastery and routes due established skills to review', () => {
    expect(actionFor(byId.get('theory.tonal-center')!).action?.intent).toBe('review');
    expect(actionFor(byId.get('procedure.steady-pulse')!).action?.intent).toBe('review');
    const notDue = { ...demoLearner, 'theory.tonal-center': { mastery: 'mastered' as const } };
    expect(actionFor(byId.get('theory.tonal-center')!, notDue).action).toBeUndefined();
  });
  it('does not route unsupported content or blocked foundations to generic lessons', () => {
    expect(actionFor(byId.get('theory.key-signatures')!).action).toBeUndefined();
    expect(actionFor(byId.get('theory.key-signatures')!).missing.map((s) => s.id)).toContain('theory.scale-steps');
    const missing = { ...demoLearner, 'theory.tonal-center': { mastery: 'unknown' as const } };
    expect(actionFor(byId.get('theory.phrase-endings')!, missing).action).toBeUndefined();
    expect(actionFor(byId.get('theory.phrasing')!).action).toBeUndefined();
  });
});
describe('stable subject layout and navigation', () => {
  it('places every node once, with readable broad clusters and separate hierarchy/prerequisites', () => {
    for (const domain of ['theory', 'procedure'] as const) {
      const points = layoutGraph(domain, rootRelationships);
      expect(new Set(points.map((p) => p.node.id)).size).toBe(skills.filter((s) => s.domain === domain).length);
      expect(points.filter((p) => p.depth === 0)).toHaveLength(6);
      expect(points.length).toBeGreaterThanOrEqual(54);
      expect(points.some((p) => p.depth === 2)).toBe(true);
      expect(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.z === 0)).toBe(true);
      const projected = projectGraph(points);
      expect(projected.every(p => p.screenX > 20 && p.screenX < mapSize.width - 20 && p.screenY > 20 && p.screenY < mapSize.height - 20)).toBe(true);
      expect(projected.map(({ x, y, z }) => ({ x, y, z }))).toEqual(points.map(({ x, y, z }) => ({ x, y, z })));
      expect(layoutGraph(domain, rootRelationships)).toEqual(points);
      for (const node of skills) for (const id of [...node.prerequisites, ...(node.parentId ? [node.parentId] : [])]) expect(byId.has(id)).toBe(true);
    }
  });

  it('keeps Procedure captions clear of satellites, including faint previews at laptop size', () => {
    const points = projectGraph(layoutGraph('procedure', rootRelationships), 1232, 636);
    const { visible, preview } = presentation(points, null, 1232, 636);
    const labels = placeLabels(points, visible, preview, null, null, 1, 1232, 636);
    expect(labels.filter(label => label.root)).toHaveLength(6);
    for (const label of labels) for (const point of points.filter(point => visible.has(point.node.id))) {
      const radius = point.depth === 0 ? 9 : point.depth === 1 ? 4.5 : 2.8;
      const overlaps = point.screenX + radius > label.x && point.screenX - radius < label.x + label.width && point.screenY + radius > label.y && point.screenY - radius < label.y + label.height;
      expect(overlaps, `${label.text} obscures ${point.node.title}`).toBe(false);
    }
  });
  it('moves selection spatially without changing learner state', () => {
    const points = layoutGraph('theory'), before = JSON.stringify(demoLearner);
    const next = neighbor(points, 'theory.phrase-endings', 'ArrowLeft');
    expect(next).not.toBe('theory.phrase-endings');
    expect(byId.has(next)).toBe(true);
    expect(JSON.stringify(demoLearner)).toBe(before);
  });
});

it('keeps the prepared target caption on its original side throughout entry instead of reselecting candidates', () => {
  for (const [width, height] of [[1392, 736], [1232, 636]]) {
    const projected = projectGraph(layoutGraph('theory'), width, height);
    const target = projected.find(point => point.node.id === 'theory.phrase-endings')!;
    const { visible, preview } = presentation(projected, null, width, height);
    const initial = placeLabels(projected, visible, preview, null, target.node.id, 1, width, height);
    const captions = anchorLabels(initial, projected);
    const initialCaption = initial.find(label => label.id === target.node.id)!;
    const offset = { x: initialCaption.x - target.screenX, y: initialCaption.y - target.screenY };
    for (let frame = 0; frame <= 44; frame++) {
      const points = viewPoints(projected, cameraAt(overviewCamera, activityCamera(target, width, height), frame / 44), width, height);
      const labels = followLabels(captions, points), caption = labels.find(label => label.id === target.node.id)!;
      const node = points.find(point => point.node.id === target.node.id)!;
      expect(labels.map(label => label.id)).toEqual(initial.map(label => label.id));
      expect(caption.x - node.screenX).toBeCloseTo(offset.x, 8);
      expect(caption.y - node.screenY).toBeCloseTo(offset.y, 8);
    }
  }
});
