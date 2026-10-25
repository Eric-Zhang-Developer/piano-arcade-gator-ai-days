import { afterEach, describe, expect, it, vi } from 'vitest';
import { INK_EVENT, type InkCue, inkCue } from './cue';

afterEach(() => vi.unstubAllGlobals());

describe('inkCue', () => {
  it('dispatches the cue on window as the event detail', () => {
    vi.stubGlobal('window', new EventTarget());
    const heard: InkCue[] = [];
    window.addEventListener(INK_EVENT, (e) => heard.push((e as CustomEvent<InkCue>).detail));
    inkCue({ kind: 'wrong' });
    inkCue({ kind: 'say', text: 'Hold the G for two beats.' });
    expect(heard).toEqual([{ kind: 'wrong' }, { kind: 'say', text: 'Hold the G for two beats.' }]);
  });

  it('does nothing on the server', () => {
    vi.stubGlobal('window', undefined);
    expect(() => inkCue({ kind: 'pass' })).not.toThrow();
  });
});
