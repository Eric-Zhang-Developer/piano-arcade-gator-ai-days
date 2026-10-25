import { describe, expect, it } from 'vitest';
import { curriculum } from '../curriculum';
import type { PassageNote, PlayingItem } from '../schema';
import { eventsOf, keys, pedalChange, scale, startMs } from './fixtures';
import type { RawMidi } from './capture';
import { helpShare, scoreTake } from './score';

const scaleItem = curriculum.items.find((i): i is PlayingItem => i.id === 'keys-major-scales-playing-1');
if (!scaleItem) throw new Error('keys-major-scales-playing-1 is missing from the curriculum');

const scaleTake = (messages: RawMidi[]) => scoreTake(scaleItem, { startMs, bpm: 72, events: eventsOf(messages) });

describe('scoreTake on the C major scale', () => {
  it('passes a clean scale', () => {
    const v = scaleTake(scale());
    expect(v.off).toEqual([]);
    expect(v.pass).toBe(true);
    expect(v.measures.notesInOrder).toBe(1);
    expect(v.measures.legato).toBe(1);
    expect(v.measures.timingSpreadMs).toBeLessThan(10);
    expect(v.measures.velocitySpread).toBeLessThan(5);
    expect(v.measures.pedal).toBeUndefined();
  });

  it('fails wrong notes on notes in order only', () => {
    const v = scaleTake(scale({ pitches: [60, 62, 63, 65, 67, 68, 71, 72] }));
    expect(v.pass).toBe(false);
    expect(v.measures.notesInOrder).toBe(0.75);
    expect(v.off).toEqual(['6 of 8 notes were right and in order.']);
  });

  it('counts extra notes against the passage', () => {
    const v = scaleTake([...scale(), { data: [0x90, 61, 64], timeMs: 2000 }, { data: [0x90, 61, 0], timeMs: 2100 }]);
    expect(v.measures.notesInOrder).toBe(8 / 9);
    expect(v.off).toEqual(['8 of 8 notes were right and in order, with 1 extra.']);
  });

  it('fails uneven timing on the timing spread only', () => {
    const v = scaleTake(scale({ lateMs: [0, 120, -90, 150, -110, 80, -130, 100] }));
    expect(v.measures.timingSpreadMs).toBeCloseTo(105.2, 1);
    expect(v.off).toEqual(['The timing wandered 105 ms around the click; keep it within 70 ms.']);
  });

  it('fails an uneven touch on the velocity spread only', () => {
    const v = scaleTake(scale({ velocity: [40, 95, 50, 100, 45, 90, 55, 85] }));
    expect(v.measures.velocitySpread).toBeGreaterThan(20);
    expect(v.off).toHaveLength(1);
    expect(v.off[0]).toMatch(/^The loudness jumped around by \d+; keep the touch even, within 20\.$/);
  });

  it('fails detached notes on legato only', () => {
    const beatMs = 60000 / 72;
    const detached = keys([60, 62, 64, 65, 67, 69, 71, 72].map((pitch, k) => ({
      pitch, atMs: startMs + k * beatMs, velocity: 64, offMs: startMs + k * beatMs + beatMs / 2,
    })));
    const v = scaleTake(detached);
    expect(v.measures.legato).toBe(0);
    expect(v.off).toEqual(['0 of 7 notes joined smoothly; hold each key until the next one goes down.']);
  });
});

describe('scoreTake on pedalled chords', () => {
  // Made here, not from the curriculum: no item has a pedal bar yet. C, F, G, C, two beats each at 60 bpm.
  const chords = [[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 67]];
  const notes: PassageNote[] = chords.flatMap((c, k) => c.map((pitch, n) => ({
    pitch, startBeat: 2 * k, beats: 2, hand: n === 0 ? 'left' : 'right',
  })));
  const item: PlayingItem = {
    type: 'playing', id: 'chords-pedal-test', nodeId: 'chords-pedal-test', prompt: '', notes, bpm: 60,
    pass: { notesInOrder: 0.9, timingSpreadMs: 70, velocitySpread: 20, pedal: 0.8 },
  };
  const at = chords.map((_, k) => startMs + 2000 * k);
  const struck = keys(chords.flatMap((c, k) => c.map((pitch, n) => ({
    pitch, atMs: at[k] + [0, 8, 4, 12][n], velocity: 70 + n, offMs: k + 1 < at.length ? at[k + 1] + 10 : at[k] + 2000,
  }))));
  const firstPress: RawMidi[] = [{ data: [0xb0, 0x40, 0x7f], timeMs: startMs - 50 }, { data: [0xb1, 0x40, 0x7f], timeMs: startMs - 49.5 }];
  const take = (pedal: RawMidi[]) => scoreTake(item, { startMs, bpm: 60, events: eventsOf([...struck, ...firstPress, ...pedal]) });

  it('passes a pedal changed just after each new chord', () => {
    const v = take(at.slice(1).flatMap((t) => pedalChange(t + 80, t + 300)));
    expect(v.off).toEqual([]);
    expect(v.measures.pedal).toBe(1);
  });

  it('fails an early pedal on the pedal bar only', () => {
    const v = take(at.slice(1).flatMap((t) => pedalChange(t - 150, t - 60)));
    expect(v.measures.pedal).toBe(0);
    expect(v.off).toEqual([
      '0 of 3 chord changes had a clean pedal change; lift the pedal just after the new chord sounds, then press it again.',
    ]);
  });

  it('fails a pedal that never goes down again', () => {
    const v = take([{ data: [0xb0, 0x40, 0x00], timeMs: at[1] + 80 }]);
    expect(v.measures.pedal).toBe(0);
  });
});

describe('helpShare', () => {
  it('is the share of the take covered by help, overlaps counted once', () => {
    expect(helpShare([{ startMs: 0, endMs: 1000 }, { startMs: 500, endMs: 2000 }, { startMs: 5000, endMs: 6000 }], 0, 10000)).toBe(0.3);
  });

  it('clips help to the take', () => {
    expect(helpShare([{ startMs: -500, endMs: 500 }, { startMs: 900, endMs: 2000 }], 0, 1000)).toBeCloseTo(0.6);
  });

  it('is 0 with no help or an empty take', () => {
    expect(helpShare([], 0, 1000)).toBe(0);
    expect(helpShare([{ startMs: 0, endMs: 1000 }], 500, 500)).toBe(0);
  });
});
