'use client';

import { useId, type MouseEvent } from 'react';
import styles from './companion.module.css';

type Props = { eyebrow?: string; title: string; reason: string; actionLabel: string; complete: boolean; entering: boolean; onStart: (event: MouseEvent<HTMLButtonElement>) => void };

/** Presents the next activity: the planner's first, else the prepared one under the eyebrow that says why. */
export function GraphCompanion({ eyebrow, title, reason, actionLabel, complete, entering, onStart }: Props) {
  const id = useId();
  return <aside className={styles.companion} aria-label="Your next activity" data-entering={entering}>
    {/* The ink's perch: it rests here, beside the next activity, while the pointer is idle. */}
    <span data-tutor-perch className={styles.perch} aria-hidden="true"/>
    <div className={styles.message}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <h2 id={`${id}-suggestion`}>{title}</h2>
      <p id={`${id}-reason`}>{complete ? 'You finished this activity. You can open it again.' : reason}</p>
      <button type="button" className={styles.action} disabled={entering} aria-label={`${actionLabel}: ${title}`} aria-describedby={`${id}-reason`} onClick={onStart}>{entering ? 'Opening…' : actionLabel}<span aria-hidden="true">→</span></button>
    </div>
  </aside>;
}
