'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, useEffect, useState } from 'react';
import { activities, LearningSessionsProvider, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';
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
    <header className={styles.topbar}>
      <Link href="/learn" onClick={cancel} className={styles.brand} aria-label="Piano Arcade learning home">Piano Arcade</Link>
      {pathname !== '/learn' && <nav aria-label="Learning navigation"><Link href="/learn" onClick={cancel}>Back to map</Link></nav>}
      <details className={styles.previewInfo}><summary>Prior UI</summary><div><p><Link href="/learn/brand-preview" onClick={cancel}>Open proposed preview ↗</Link></p><p>Example activities. Sessions remain while you navigate learning pages. Refreshing or leaving learning clears them.</p><p>Practice takes and feedback are scripted demonstrations; no performance is recorded or graded. The prepared activity is an authored demo, not a live agent decision. No account, progress sync or AI grading is connected.</p><Link href="/" onClick={cancel}>Back to arcade <span aria-hidden="true">↗</span></Link></div></details>
    </header></>}
    <div className={styles.main}>
      {offline && <section className={styles.offline} role="alert"><h1>You’re offline</h1><p>Reconnect to continue. This preview has no account sync; nothing has been uploaded.</p><button onClick={() => setOffline(!navigator.onLine)}>Check connection</button></section>}
      <Activity mode={offline ? 'hidden' : 'visible'}><main id="learning-content" className={styles.content} data-guided-docking={active?.phase === 'docking'} data-guided-transition={active?.phase === 'docking' || active?.phase === 'revealing'} data-guided-reveal={active?.phase === 'revealing'} data-reduced={active?.reduced} style={active ? { '--arrival-x': `${active.plan.bounds.left+active.plan.bounds.width/2}px`, '--arrival-y': `calc(${active.plan.bounds.top+active.plan.bounds.height/2}px - var(--learn-header-height))` } as React.CSSProperties : undefined}>{children}</main></Activity>
    </div>
  </div>;
}
