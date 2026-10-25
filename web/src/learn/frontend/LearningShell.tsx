'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, useEffect, useState } from 'react';
import { activities, LearningSessionsProvider, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';
import { DuoScope } from './duo/DuoScope';
import { GuidedEntryProvider, useGuidedEntry } from './graph/GuidedEntry';

export function LearningShell({ children }: { children: React.ReactNode }) {
  return <LearningSessionsProvider><GuidedEntryProvider><LearningChrome>{children}</LearningChrome></GuidedEntryProvider></LearningSessionsProvider>;
}
function LearningChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reviewingBrand = pathname === '/learn/brand-preview';
  const { active, cancel } = useGuidedEntry();
  const { markStarted } = useLearningSessions();
  const [offline, setOffline] = useState(false);
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
    {!reviewingBrand && <><a href="#learning-content" className={styles.skip}>Skip to content</a>
    <DuoScope className={styles.chrome}><header className={styles.topbar}>
      <Link href="/learn" onClick={cancel} className={styles.brand} aria-label="Piano Arcade learning home">Piano Arcade</Link>
      {pathname !== '/learn' && <nav aria-label="Learning navigation"><Link href="/learn" onClick={cancel}>Back to map</Link></nav>}
      {/* #944: plain words for what a judge needs to know, and the way back in view; no second learning home */}
      <p className={styles.honest}>Sample learner · no account</p>
      <Link href="/" onClick={cancel} className={styles.arcade}>Back to arcade</Link>
    </header></DuoScope></>}
    <div className={styles.main}>
      {offline && <section className={styles.offline} role="alert"><h1>You’re offline</h1><p>Reconnect to continue. This preview has no account sync; nothing has been uploaded.</p><button onClick={() => setOffline(!navigator.onLine)}>Check connection</button></section>}
      <Activity mode={offline ? 'hidden' : 'visible'}><main id="learning-content" className={styles.content} data-guided-docking={active?.phase === 'docking'} data-guided-transition={active?.phase === 'docking' || active?.phase === 'revealing'} data-guided-reveal={active?.phase === 'revealing'} data-reduced={active?.reduced} style={active ? { '--arrival-x': `${active.plan.bounds.left+active.plan.bounds.width/2}px`, '--arrival-y': `calc(${active.plan.bounds.top+active.plan.bounds.height/2}px - var(--learn-header-height))` } as React.CSSProperties : undefined}>{children}</main></Activity>
    </div>
  </div>;
}
