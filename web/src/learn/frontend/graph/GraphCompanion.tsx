'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import type { GraphAction, Skill } from './data';
import styles from './companion.module.css';

export type CompanionControl = { collapsed: boolean; onCollapsedChange: (collapsed: boolean) => void };
type Props = CompanionControl & { skill: Skill; action: GraphAction; reason: string; onAction: (action: GraphAction) => void };

/** A quiet guide for the existing graph recommendation, never a separate coach policy. */
export function GraphCompanion({ skill, action, reason, collapsed, onCollapsedChange, onAction }: Props) {
  const [idle, setIdle] = useState(false);
  const id = useId();
  const restore = useRef<HTMLButtonElement>(null), actionButton = useRef<HTMLButtonElement>(null);
  function collapse() { onCollapsedChange(true); requestAnimationFrame(() => restore.current?.focus()); }
  function expand() { onCollapsedChange(false); requestAnimationFrame(() => actionButton.current?.focus()); }
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setIdle(document.visibilityState === 'visible' && !motion.matches);
    update(); document.addEventListener('visibilitychange', update); motion.addEventListener('change', update);
    return () => { document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update); };
  }, []);
  const pet = <Image className={styles.pet} data-idle={idle && !collapsed} src="/learning/companion-gator.svg" alt="" width={76} height={76} unoptimized loading="eager"/>;
  return <aside className={styles.companion} aria-label="Practice companion" data-target-skill={skill.id} data-collapsed={collapsed}>
    {collapsed ? <button type="button" ref={restore} className={styles.restore} aria-label="Show companion suggestion" onClick={expand}>{pet}</button> : <>
      <div className={styles.character} aria-hidden="true">{pet}</div>
      <div className={styles.message}>
        <h2 id={`${id}-suggestion`}>{skill.short}</h2>
        <p id={`${id}-reason`}>{reason}</p>
        <button type="button" ref={actionButton} className={styles.action} aria-label={`Try ${skill.title}`} aria-describedby={`${id}-reason`} onClick={() => onAction(action)}>Try it<span aria-hidden="true">→</span></button>
      </div>
      <button type="button" className={styles.collapse} aria-label="Hide companion suggestion" onClick={collapse}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button>
    </>}
  </aside>;
}
