import { describe, expect, it } from 'vitest';
import { actionFor, byId, demoGoal, demoLearner, recommendation, skills } from './data';
import { layoutGraph, mapSize, neighbor } from './layout';

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
      const points = layoutGraph(domain);
      expect(new Set(points.map((p) => p.node.id)).size).toBe(skills.filter((s) => s.domain === domain).length);
      expect(points.filter((p) => p.depth === 0)).toHaveLength(4);
      expect(points.some((p) => p.depth === 2)).toBe(true);
      expect(points.every((p) => p.x > 20 && p.x < mapSize.width - 20 && p.y > 20 && p.y < mapSize.height - 20)).toBe(true);
      expect(layoutGraph(domain)).toEqual(points);
      for (const node of skills) for (const id of [...node.prerequisites, ...(node.parentId ? [node.parentId] : [])]) expect(byId.has(id)).toBe(true);
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
