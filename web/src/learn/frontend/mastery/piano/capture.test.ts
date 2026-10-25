import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenToPiano, parseMidi, type PianoEvent, type PianoStatus } from './capture';
import { recordedPedal } from './fixtures';

afterEach(() => { vi.unstubAllGlobals(); });

describe('parseMidi', () => {
  it('keeps the channel 1 pedal and ignores the channel 2 copy', () => {
    const events = recordedPedal.flatMap((m) => parseMidi(m.data, m.timeMs ?? 0) ?? []);
    const pedal = events.filter((e) => e.type === 'pedal');
    expect(pedal).toHaveLength(11);
    expect(pedal.filter((e, k) => e.down !== (pedal[k - 1]?.down ?? false))).toEqual([
      { type: 'pedal', down: true, timeMs: 112871.2 },
      { type: 'pedal', down: false, timeMs: 114802.9 },
    ]);
  });

  it('reads keys, a note-on at velocity 0 as a release, and drops the rest', () => {
    expect(parseMidi([0x90, 60, 80], 5)).toEqual({ type: 'on', pitch: 60, velocity: 80, timeMs: 5 });
    expect(parseMidi([0x90, 60, 0], 6)).toEqual({ type: 'off', pitch: 60, velocity: 0, timeMs: 6 });
    expect(parseMidi([0x80, 60, 40], 7)).toEqual({ type: 'off', pitch: 60, velocity: 0, timeMs: 7 });
    expect(parseMidi([0x91, 60, 80], 8)).toBeNull();
    expect(parseMidi([0xb0, 7, 100], 9)).toBeNull();
    expect(parseMidi([0xfe], 10)).toBeNull();
  });
});

function listen() {
  const events: PianoEvent[] = [];
  const statuses: PianoStatus[] = [];
  return { events, statuses, stop: listenToPiano((e) => events.push(e), (s) => statuses.push(s)) };
}

describe('listenToPiano', () => {
  it('with ?sim, hears the window hook and removes it on stop', async () => {
    const win: Window = { location: { search: '?sim' } } as unknown as Window;
    vi.stubGlobal('window', win);
    const { events, statuses, stop } = listen();
    const end = await stop;
    expect(statuses).toEqual([{ state: 'piano', name: 'Simulated piano' }]);
    for (const m of recordedPedal) win.__masteryMidi?.push(m);
    win.__masteryMidi?.push({ data: [0x90, 60, 80], timeMs: 3 });
    expect(events).toHaveLength(12);
    expect(events.at(-1)).toEqual({ type: 'on', pitch: 60, velocity: 80, timeMs: 3 });
    end();
    expect(win.__masteryMidi).toBeUndefined();
  });

  it('says there is no piano without Web MIDI', async () => {
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('navigator', {});
    const { statuses, stop } = listen();
    await stop;
    expect(statuses).toEqual([{ state: 'no-piano', reason: 'This browser cannot hear a piano. Open the page in Chrome.' }]);
  });

  it('says there is no piano when MIDI is refused', async () => {
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('navigator', { requestMIDIAccess: () => Promise.reject(new Error('denied')) });
    const { statuses, stop } = listen();
    await stop;
    expect(statuses).toEqual([{ state: 'no-piano', reason: 'The browser was not allowed to hear the piano.' }]);
  });

  it('hears the Portable Grand and follows it being unplugged', async () => {
    const input = (name: string) => Object.assign(new EventTarget(), { name, state: 'connected' });
    const other = input('IAC Driver Bus 1');
    const piano = input('Digital Keyboard Portable Grand');
    const access = Object.assign(new EventTarget(), { inputs: new Map([['a', other], ['b', piano]]) });
    vi.stubGlobal('window', { location: { search: '' } });
    vi.stubGlobal('navigator', { requestMIDIAccess: () => Promise.resolve(access) });
    const { events, statuses, stop } = listen();
    const end = await stop;
    expect(statuses).toEqual([{ state: 'piano', name: 'Digital Keyboard Portable Grand' }]);

    const message = (data: number[], timeStamp: number) =>
      Object.defineProperties(new Event('midimessage'), { data: { value: new Uint8Array(data) }, timeStamp: { value: timeStamp } });
    piano.dispatchEvent(message([0x90, 64, 70], 120.5));
    other.dispatchEvent(message([0x90, 65, 70], 121));
    expect(events).toEqual([{ type: 'on', pitch: 64, velocity: 70, timeMs: 120.5 }]);

    other.state = 'disconnected';
    piano.state = 'disconnected';
    access.dispatchEvent(new Event('statechange'));
    expect(statuses.at(-1)).toEqual({ state: 'no-piano', reason: 'No piano is plugged in.' });
    piano.dispatchEvent(message([0x90, 66, 70], 130));
    expect(events).toHaveLength(1);
    end();
  });
});
