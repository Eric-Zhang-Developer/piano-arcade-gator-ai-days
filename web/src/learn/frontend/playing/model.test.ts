import { describe, expect, it } from 'vitest';
import { fadeSupport, initialPractice, music, practiceReducer, takeTransition, targetTempo, totalBeats } from './model';

describe('practice flow', () => {
  it('removes only one support at a time', () => {
    const withoutHints = fadeSupport({ hints: true, tempo: 72 });
    expect(withoutHints).toEqual({ hints: false, tempo: 72 });
    expect(fadeSupport(withoutHints)).toEqual({ hints: false, tempo: targetTempo });
  });
  it('requires the practice move before completion, then fades and finishes', () => {
    let s = practiceReducer(initialPractice, { type: 'start' });
    s = practiceReducer(s, { type: 'finish' });
    expect(s.stage).toBe('feedback');
    s = practiceReducer(s, { type: 'drill' });
    for (let i = 0; i < 4; i++) s = practiceReducer(s, { type: 'repeat' });
    expect(s.stage).toBe('fade');
    s = practiceReducer(s, { type: 'start' });
    expect(s.hints).toBe(false); expect(s.tempo).toBe(72);
    s = practiceReducer(s, { type: 'finish' });
    expect(s.stage).toBe('fade');
    s = practiceReducer(s, { type: 'start' });
    expect(s.tempo).toBe(targetTempo);
    s = practiceReducer(s, { type: 'finish' });
    expect(s.stage).toBe('complete'); expect(s.takes).toBe(3);
  });
  it('locks controls and ignores duplicate starts or completions', () => {
    const s = practiceReducer(initialPractice, { type: 'start' });
    expect(practiceReducer(s, { type: 'settings', settings: { tempo: 100 } })).toBe(s);
    expect(practiceReducer(s, { type: 'start' })).toBe(s);
    expect(practiceReducer(initialPractice, { type: 'finish' })).toBe(initialPractice);
    expect(practiceReducer(s, { type: 'stop' }).takes).toBe(0);
  });
});
describe('independent take', () => {
  it('finishes directly at results and allows a new take after stopping', () => {
    let phase = takeTransition('ready', 'start');
    expect(takeTransition(phase, 'finish')).toBe('countin');
    phase = takeTransition(phase, 'counted');
    expect(takeTransition(phase, 'finish')).toBe('result');
    expect(takeTransition(phase, 'stop')).toBe('ready');
    expect(takeTransition('result', 'again')).toBe('ready');
  });
  it('uses the cited chart duration without inventing take metrics', () => {
    expect(music.source).toContain('mutopiaproject.org');
    expect(totalBeats).toBe(48);
    expect(music.notes.every((n) => n.hand === 'R')).toBe(true);
  });
});
