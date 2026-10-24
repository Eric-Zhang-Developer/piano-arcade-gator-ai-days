'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './learning.module.css';

const activities = [
  ['/learn/understand', 'Understand'],
  ['/learn/practice', 'Practice'],
  ['/learn/review', 'Theory review'],
  ['/learn/play-through', 'Play-through'],
] as const;

export function LearningShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return <div className={styles.app}>
    <a href="#learning-content" className={styles.skip}>Skip to activity</a>
    <aside className={styles.rail}>
      <Link href="/learn" className={styles.brand} aria-label="Piano Arcade learning home"><svg viewBox="0 0 28 30" aria-hidden="true"><path d="M2 2h24v26H2zM10 2v26M18 2v26"/><path d="M7 2h6v15H7zM15 2h6v15h-6z" fill="currentColor"/></svg><span>Piano<br/>Arcade</span></Link>
      <nav aria-label="Learning activities">{activities.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || (pathname === '/learn' && href.endsWith('/understand')) ? 'page' : undefined}><span>{label}</span></Link>)}</nav>
      <div className={styles.railBottom}><span className={styles.preview}>Frontend preview</span><details><summary>About this preview</summary><p>Example activities. Answers stay in this browser tab and reset when you leave the activity. No account, progress sync or AI grading is connected.</p><p>The full learning service will require internet and carry acknowledged history between devices.</p></details><Link href="/">Back to arcade <span aria-hidden="true">↗</span></Link></div>
    </aside>
    <div className={styles.main}>
      {offline ? <section className={styles.offline} role="alert"><h1>You’re offline</h1><p>Reconnect to continue. This preview has no account sync; nothing has been uploaded.</p><button onClick={() => setOffline(!navigator.onLine)}>Check connection</button></section> : <main id="learning-content" className={styles.content}>{children}</main>}
    </div>
  </div>;
}
