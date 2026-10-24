'use client';

import Image from 'next/image';
import { useEffect, useId, useState, type MouseEvent } from 'react';
import styles from './companion.module.css';

export type CompanionControl = { collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void };
type Props = { title: string; reason: string; actionLabel: string; complete: boolean; entering: boolean; onStart: (event: MouseEvent<HTMLButtonElement>) => void; onDismiss: () => void };

/** Presents a prepared fixture; exploring the map cannot make a new assignment. */
export function GraphCompanion({ title, reason, actionLabel, complete, entering, onStart, onDismiss }: Props) {
  const [idle, setIdle] = useState(false);
  const id = useId();
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setIdle(document.visibilityState === 'visible' && !motion.matches);
    update(); document.addEventListener('visibilitychange', update); motion.addEventListener('change', update);
    return () => { document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update); };
  }, []);
  return <aside className={styles.companion} aria-label="Your next activity">
    <Image className={styles.pet} data-idle={idle && !entering} src="/learning/companion-gator.svg" alt="" width={112} height={112} unoptimized loading="eager"/>
    <div className={styles.message}>
      <span className={styles.eyebrow}>{complete ? 'Completed' : 'Up next'}</span>
      <h2 id={`${id}-suggestion`}>{title}</h2>
      <p id={`${id}-reason`}>{complete ? 'You finished this example. You can revisit it without changing the sample mastery map.' : reason}</p>
      <button type="button" className={styles.action} disabled={entering} aria-label={`${actionLabel}: ${title}`} aria-describedby={`${id}-reason`} onClick={onStart}>{entering ? 'Opening…' : actionLabel}<span aria-hidden="true">→</span></button>
    </div>
    <button type="button" className={styles.collapse} disabled={entering} aria-label="Hide next activity" onClick={onDismiss}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
  </aside>;
}
