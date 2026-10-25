import { describe, expect, it } from 'vitest';
import { actionFor, byId } from './data';
import { contextualActivity, goalActivities, preparedActivity } from './prepared';

describe('contextual activity entry', () => {
  it('routes each supported demonstration to its activity', () => {
    const mappings = {
      'theory.phrase-endings': '/learn/understand',
      'theory.tonal-center': '/learn/review/theory',
      'procedure.short-phrase-coordination': '/learn/practice',
      'procedure.held-endings': '/learn/practice',
      'procedure.steady-pulse': '/learn/play-through',
    };
    for (const [id, href] of Object.entries(mappings)) {
      const skill = byId.get(id)!;
      const target = contextualActivity(actionFor(skill).action!);
      expect(target?.activity.href).toBe(href);
    }
    expect(contextualActivity(preparedActivity.action)?.activity.id).toBe(preparedActivity.activityId);
  });
  it('rejects unavailable lessons and mismatched activity intents or domains', () => {
    expect(contextualActivity({ skillId: 'theory.key-signatures', domain: 'theory', intent: 'learn' })).toBeNull();
    expect(contextualActivity({ ...preparedActivity.action, domain: 'procedure' })).toBeNull();
    expect(contextualActivity({ ...preparedActivity.action, intent: 'review' })).toBeNull();
  });
});

describe('the goal after the first example (#943)', () => {
  it('offers each of the goal\'s targets in order, each with its own activity', () => {
    expect(goalActivities.map(a => [a.skillId, contextualActivity(a.action)?.activity.href])).toEqual([
      ['theory.phrase-endings', '/learn/understand'],
      ['procedure.short-phrase-coordination', '/learn/practice'],
      ['theory.tonal-center', '/learn/review/theory'],
      ['procedure.steady-pulse', '/learn/play-through'],
    ]);
    expect(new Set(goalActivities.map(a => a.activityId)).size).toBe(4);
  });
});
