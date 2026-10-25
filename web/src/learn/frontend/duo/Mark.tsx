import type { ReactNode } from 'react';
import styles from './duo.module.css';

const words = { correct: 'Correct', wrong: 'Wrong' } as const;

// A judged answer. Colour is never the only cue: the word always shows, and red always comes with its ✕.
export function Mark({ kind, children }: { kind: 'correct' | 'wrong'; children?: ReactNode }) {
  return <span data-kind={kind} className={styles.mark}>
    {kind === 'wrong' && <span aria-hidden="true">✕</span>}
    <span>{children ?? words[kind]}</span>
  </span>;
}
