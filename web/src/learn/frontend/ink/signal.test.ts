import { describe, expect, it } from 'vitest';
import { INK_EVENT, parseInkSignal } from './signal';

describe('parseInkSignal', () => {
  it('reads every cue the activities send', () => {
    for (const kind of ['right', 'wrong', 'pass', 'fail', 'next'] as const) expect(parseInkSignal({ kind })).toEqual({ kind });
    expect(parseInkSignal({ kind: 'say', text: '  Bar 4 comes\n home to C.  ' })).toEqual({ kind: 'say', text: 'Bar 4 comes home to C.' });
  });

  it('drops text on cues that do not speak', () => {
    expect(parseInkSignal({ kind: 'pass', text: 'ignored' })).toEqual({ kind: 'pass' });
  });

  it('ignores bad detail without throwing', () => {
    const hostile = new Proxy({}, { get() { throw new Error('boom'); } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const detail of [undefined, null, 0, 'right', [], {}, { kind: 'cheer' }, { kind: 3 }, { kind: 'RIGHT' }, { kind: 'say' }, { kind: 'say', text: 7 },
      { kind: 'say', text: '   ' }, { kind: 'say', text: 'x'.repeat(241) }, hostile, revoked.proxy]) {
      expect(() => parseInkSignal(detail)).not.toThrow();
      expect(parseInkSignal(detail)).toBeNull();
    }
  });

  it('listens on the name the senders dispatch', () => {
    expect(INK_EVENT).toBe('etude:ink');
  });
});
