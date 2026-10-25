import { useEffect, useRef } from 'react';
import type { PianoStatus } from '../mastery/piano/capture';
import type { TakeResult } from './useTake';
import styles from './playing.module.css';

const silentText = 'The browser kept the sound off, so there was no click. Tap the page and try again for the count-in.';
const unsavedText = 'This take could not be saved. It still shows here, but it won’t count.';

/** What stops a take from starting: no piano yet, and why. Empty once one is listening. */
const pianoProblem = (status: PianoStatus | null) => !status ? 'Looking for a piano…' : status.state === 'piano' ? '' : status.reason;

/**
 * One line for what stands between the learner and a clean take: no piano, or a browser that kept the sound off.
 * It stays mounted and empty when nothing does, and goes `quiet` while a result's notes say it instead.
 */
export function ProblemLine({ status, silent, quiet }: { status: PianoStatus | null; silent: boolean; quiet: boolean }) {
  const text = quiet ? '' : [pianoProblem(status), silent ? silentText : ''].filter(Boolean).join(' ');
  return <p className={styles.pianoLine} role="status">{text && <><span aria-hidden="true" />{text}</>}</p>;
}

/** The count-in number, from 4 down to 1. */
export const countIn = (beat: number) => String(Math.min(4, Math.max(1, Math.ceil(-beat))));

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

export type TakeNote = { text: string; kind: 'problem' | 'off' | 'help' };

/**
 * What a finished take has to say, most pressing first: one line for anything that went wrong around it (no piano, not
 * saved, no sound), what was off in the scorer's words, then `help` when the take's help kept it from counting.
 */
export function takeNotes(result: TakeResult, { status, silent, help }: { status: PianoStatus | null; silent: boolean; help?: string }): TakeNote[] {
  const problem = [pianoProblem(status), result.saved === false ? unsavedText : '', silent ? silentText : ''].filter(Boolean).join(' ');
  return [
    ...(problem ? [{ text: problem, kind: 'problem' as const }] : []),
    ...result.verdict.off.map((text) => ({ text, kind: 'off' as const })),
    ...(help && !result.counts && result.saved !== false ? [{ text: help, kind: 'help' as const }] : []),
  ];
}

/** A take's notes as one item: the first in full, the rest behind it. No `<div>`, so it sits inside a live region. */
export function TakeNotes({ notes }: { notes: TakeNote[] }) {
  const [first, ...rest] = notes;
  if (!first) return null;
  if (!rest.length) return <p className={styles.noteLine} data-kind={first.kind}>{first.text}</p>;
  return <details className={styles.notes}>
    <summary data-kind={first.kind}>{first.text} <span>+{rest.length} more</span></summary>
    <ul>{rest.map((note, i) => <li key={i} data-kind={note.kind}>{note.text}</li>)}</ul>
  </details>;
}
