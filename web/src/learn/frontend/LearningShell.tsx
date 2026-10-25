'use client';

import { usePathname } from 'next/navigation';
import { Activity, useEffect, useRef, useState } from 'react';
import { activities, LearningSessionsProvider, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';
import { GuidedEntryProvider, useGuidedEntry } from './graph/GuidedEntry';
import { InkTutor } from './ink/InkTutor';

export function LearningShell({ children }: { children: React.ReactNode }) {
  return <LearningSessionsProvider><GuidedEntryProvider><LearningChrome>{children}</LearningChrome></GuidedEntryProvider></LearningSessionsProvider>;
}
function LearningChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reviewingBrand = pathname === '/learn/brand-preview';
  const { active } = useGuidedEntry();
  const { markStarted } = useLearningSessions();
  const [offline, setOffline] = useState(false);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    const activity = activities.find(item => item.href === pathname);
    if (activity) markStarted(activity.id);
  }, [pathname, markStarted]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <div className={styles.app}>
    {/* No bar of its own: the site's nav band already holds Learn (the map) and Play (the arcade), and the agent drives,
        so the brand, Back to map, the honest line and Back to arcade each duplicated it or told the student nothing to act on. */}
    {!reviewingBrand && <a href="#learning-content" className={styles.skip}>Skip to content</a>}
    {/* The tutor is ink across the whole screen, on every page but the brand review, which draws its own light ground.
        On a guided entry it is the ink that carries the student into the node, and the new page opens through it. */}
    {!reviewingBrand && <InkTutor guide={active && !active.reduced ? active.frame.pet : null} turn={active?.phase === 'turning' ? content : null}/>}
    <div className={styles.main}>
      {offline && <section className={styles.offline} role="alert"><h1>You’re offline</h1><p>Reconnect to continue. This preview has no account sync; nothing has been uploaded.</p><button onClick={() => setOffline(!navigator.onLine)}>Check connection</button></section>}
      <Activity mode={offline ? 'hidden' : 'visible'}><main ref={content} id="learning-content" className={styles.content} data-guided-docking={active?.phase === 'docking'} data-guided-transition={active?.phase === 'docking' || active?.phase === 'turning'} data-reduced={active?.reduced} style={active ? { '--arrival-x': `${active.plan.bounds.left+active.plan.bounds.width/2}px`, '--arrival-y': `calc(${active.plan.bounds.top+active.plan.bounds.height/2}px - var(--learn-header-height))` } as React.CSSProperties : undefined}>{children}</main></Activity>
    </div>
  </div>;
}
