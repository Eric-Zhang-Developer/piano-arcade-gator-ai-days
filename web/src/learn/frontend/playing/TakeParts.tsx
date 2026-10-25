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
