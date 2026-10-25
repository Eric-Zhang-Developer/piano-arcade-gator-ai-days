import { useEffect, useRef } from 'react';
import type { PianoStatus } from '../mastery/piano/capture';
import type { TakePhase, TakeResult } from './useTake';
import styles from './playing.module.css';

/** Whether a piano is listening, and why not when it isn't. */
export function PianoLine({ status }: { status: PianoStatus | null }) {
  const text = !status ? 'Looking for a piano…' : status.state === 'piano' ? `${status.name} is listening.` : status.reason;
  return <p className={styles.pianoLine} data-ready={status?.state === 'piano'} role="status"><span aria-hidden="true" />{text}</p>;
}

/** The count-in, then the beat being played. */
export function TakeCount({ phase, beat, beats }: { phase: TakePhase; beat: number; beats: number }) {
  if (phase === 'countin') return <p className={styles.count} aria-live="assertive">{Math.min(4, Math.max(1, Math.ceil(-beat)))}</p>;
  if (phase === 'playing') return <p className={styles.repetitions}>Beat {Math.min(beats, Math.floor(beat) + 1)} of {beats}</p>;
  return null;
}

/**
 * A take's actions, keeping the keyboard's place (#1275): when the control holding focus goes (Start becomes Stop, a
 * link replaces a button at the end), focus moves to the group's first control instead of falling to <body>.
 */
export function useKeepFocus() {
  const group = useRef<HTMLDivElement>(null);
  const inside = useRef(false); // the last focus, press or click was in the group; a removed button fires none
  useEffect(() => {
    // Capture, so the click is counted before React's own listener re-renders and the effect below runs.
    const events = ['focusin', 'pointerdown', 'click'] as const;
    const track = (e: Event) => { inside.current = !!group.current?.contains(e.target as Node); };
    for (const type of events) document.addEventListener(type, track, true);
    return () => { for (const type of events) document.removeEventListener(type, track, true); };
  }, []);
  useEffect(() => {
    // A removed button can stay document.activeElement until the browser's next rendering update, so disconnected counts.
    const active = document.activeElement, lost = !active || active === document.body || !active.isConnected;
    if (inside.current && lost) group.current?.querySelector<HTMLElement>('button:not(:disabled), a[href]')?.focus();
  });
  return group;
}

/** What was off in a take, in the scorer's words. */
export function OffList({ result }: { result: TakeResult }) {
  return result.verdict.off.length ? <ul className={styles.offList}>{result.verdict.off.map((line) => <li key={line}>{line}</li>)}</ul> : null;
}

/** A take that could not be saved, or that ran without sound, says so. */
export function TakeWarnings({ result, silent }: { result: TakeResult | null; silent: boolean }) {
  return <>
    {result?.saved === false && <p className={styles.error} role="alert">This take could not be saved. It still shows here, but it won&apos;t count.</p>}
    {silent && <p className={styles.error} role="alert">The browser kept the sound off, so there was no click. Tap the page and try again for the count-in.</p>}
  </>;
}
