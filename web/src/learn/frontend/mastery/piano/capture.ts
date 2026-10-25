import type { InputEvent } from '@/contracts';

/** A key or the sustain pedal, timed in the `performance.now()` domain. Pedal is down at CC 64 value 64 or more. */
export type PianoEvent = InputEvent | { type: 'pedal'; down: boolean; timeMs: number };

/** Whether evidence can come in. Laptop keys never count, so without a MIDI piano there is no piano. */
export type PianoStatus = { state: 'piano'; name: string } | { state: 'no-piano'; reason: string };

/** One raw MIDI message, as the `?sim` hook takes it: `window.__masteryMidi.push({ data: [0x90, 60, 80] })`. */
export type RawMidi = { data: readonly number[]; timeMs?: number };

declare global {
  interface Window {
    __masteryMidi?: { push(message: RawMidi): void };
  }
}

/**
 * Reads one DGX-660 message. Keys and pedal come on channel 1; the pedal's channel 2 copy, active sensing, clock and
 * everything else are dropped. A release is a note-on at velocity 0 (or a note-off).
 */
export function parseMidi(data: ArrayLike<number>, timeMs: number): PianoEvent | null {
  if (data.length < 3 || (data[0] & 0x0f) !== 0) return null;
  const command = data[0] & 0xf0;
  if (command === 0x90 && data[2] > 0) return { type: 'on', pitch: data[1], velocity: data[2], timeMs };
  if (command === 0x90 || command === 0x80) return { type: 'off', pitch: data[1], velocity: 0, timeMs };
  if (command === 0xb0 && data[1] === 64) return { type: 'pedal', down: data[2] >= 64, timeMs };
  return null;
}

/**
 * Hears the piano until the returned stop is called. With `?sim` in the URL the piano is the `window.__masteryMidi`
 * hook instead, so a test can play it. Otherwise it listens to the Portable Grand (or the first connected input) and
 * follows plugging and unplugging.
 */
export async function listenToPiano(onEvent: (e: PianoEvent) => void, onStatus: (s: PianoStatus) => void): Promise<() => void> {
  if (new URLSearchParams(window.location.search).has('sim')) {
    window.__masteryMidi = {
      push: (m) => {
        const e = parseMidi(m.data, m.timeMs ?? performance.now());
        if (e) onEvent(e);
      },
    };
    onStatus({ state: 'piano', name: 'Simulated piano' });
    return () => { delete window.__masteryMidi; };
  }
  if (!navigator.requestMIDIAccess) {
    onStatus({ state: 'no-piano', reason: 'This browser cannot hear a piano. Open the page in Chrome.' });
    return () => {};
  }
  let access: MIDIAccess;
  try {
    access = await navigator.requestMIDIAccess();
  } catch {
    onStatus({ state: 'no-piano', reason: 'The browser was not allowed to hear the piano.' });
    return () => {};
  }
  const onMessage = (m: Event) => {
    const { data, timeStamp } = m as MIDIMessageEvent;
    const e = data && parseMidi(data, timeStamp);
    if (e) onEvent(e);
  };
  let input: MIDIInput | undefined;
  const pick = () => {
    const connected = [...access.inputs.values()].filter((i) => i.state !== 'disconnected');
    const next = connected.find((i) => i.name?.includes('Portable Grand')) ?? connected[0];
    if (next === input) return;
    input?.removeEventListener('midimessage', onMessage);
    input = next;
    input?.addEventListener('midimessage', onMessage);
    onStatus(input ? { state: 'piano', name: input.name ?? 'Piano' } : { state: 'no-piano', reason: 'No piano is plugged in.' });
  };
  pick();
  access.addEventListener('statechange', pick);
  return () => {
    access.removeEventListener('statechange', pick);
    input?.removeEventListener('midimessage', onMessage);
  };
}
