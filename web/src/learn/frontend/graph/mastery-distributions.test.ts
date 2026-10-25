import { describe, expect, it } from 'vitest';
import { actionFor, byId, demoLearner, demoPrior, displayMastery, skills, stateOf } from './data';

describe('illustrative mastery distributions', () => {
  it('covers every authored node, including parents, with normalized nonnegative mass', () => {
    expect(Object.keys(demoLearner).sort()).toEqual(skills.map(node => node.id).sort());
    for (const node of skills) {
      const state = stateOf(node.id), mass = Object.values(state.distribution);
      expect(mass.every(p => Number.isFinite(p) && p >= 0 && p <= 1), node.id).toBe(true);
      expect(mass.reduce((sum, p) => sum + p, 0), node.id).toBeCloseTo(1, 12);
      expect(state.displayMastery).toBe(displayMastery(state.distribution));
      expect(['fictional', 'prior']).toContain(state.distributionSource);
    }
  });
  it('authors varied broad-parent displays independently in each domain', () => {
    for (const domain of ['theory', 'procedure'] as const) {
      const parents = skills.filter(node => node.domain === domain && !node.parentId);
      expect(new Set(parents.map(node => stateOf(node.id).displayMastery))).toEqual(new Set(['mastered', 'developing', 'unknown']));
      expect(parents.every(node => stateOf(node.id).distributionSource === 'fictional')).toBe(true);
    }
  });
  it('retains a broad prior when evidence is absent instead of assigning certain failure', () => {
    const absent = stateOf('no-observation', {});
    expect(absent.distribution).toEqual(demoPrior);
    expect(absent.distributionSource).toBe('prior');
    expect(absent.distribution.low).toBeLessThan(1);
    expect(absent.mastery).toBe('unknown'); // no eligibility established
  });
  it('does not use uncertainty as a mastery level or discard it after projection', () => {
    const concentrated = { low: 0, partial: 1, secure: 0 };
    const spread = { low: .5, partial: 0, secure: .5 };
    expect(displayMastery(concentrated)).toBe(displayMastery(spread));
    expect(concentrated).not.toEqual(spread); // equal expectation, different uncertainty
    expect(displayMastery({ low: 1, partial: 0, secure: 0 })).toBe('unknown');
    expect(displayMastery({ low: 0, partial: 0, secure: 1 })).toBe('mastered');
  });
  it('keeps scheduling and current activity eligibility separate from display projection', () => {
    const due = stateOf('theory.tonal-center');
    expect(stateOf('theory.tonal-center', { 'theory.tonal-center': { ...due, due: false } }).displayMastery).toBe(due.displayMastery);
    expect(actionFor(byId.get('theory.tonal-center')!).action?.intent).toBe('review');
    const unestablished = { ...demoLearner, 'theory.tonal-center': { mastery: 'unknown' as const, distribution: { low: 0, partial: 0, secure: 1 } } };
    expect(stateOf('theory.tonal-center', unestablished).displayMastery).toBe('mastered');
    expect(actionFor(byId.get('theory.phrase-endings')!, unestablished).action).toBeUndefined();
  });
});
