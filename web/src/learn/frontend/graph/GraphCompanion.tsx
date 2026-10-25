'use client';

import Image from 'next/image';
import { useEffect, useId, useState, type MouseEvent } from 'react';
import styles from './companion.module.css';

type Props = { eyebrow?: string; title: string; reason: string; actionLabel: string; complete: boolean; entering: boolean; onStart: (event: MouseEvent<HTMLButtonElement>) => void };

/** Presents the next activity: the planner's first, else the prepared one. */
export function GraphCompanion({ eyebrow, title, reason, actionLabel, complete, entering, onStart }: Props) {
  const [idle, setIdle] = useState(false);
  const id = useId();
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setIdle(document.visibilityState === 'visible' && !motion.matches);
    update(); document.addEventListener('visibilitychange', update); motion.addEventListener('change', update);
    return () => { document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update); };
  }, []);
  return <aside className={styles.companion} aria-label="Your next activity" data-entering={entering}>
    <Image data-gator-perch className={styles.pet} data-idle={idle && !entering} src="/learning/companion-gator.svg" alt="" width={112} height={112} unoptimized loading="eager"/>
    <div className={styles.message}>
      <span className={styles.eyebrow}>{complete ? 'Completed' : eyebrow ?? 'Up next'}</span>
      <h2 id={`${id}-suggestion`}>{title}</h2>
      <p id={`${id}-reason`}>{complete ? 'You finished this activity. You can open it again.' : reason}</p>
      <button type="button" className={styles.action} disabled={entering} aria-label={`${actionLabel}: ${title}`} aria-describedby={`${id}-reason`} onClick={onStart}>{entering ? 'Opening…' : actionLabel}<span aria-hidden="true">→</span></button>
    </div>
  </aside>;
}
