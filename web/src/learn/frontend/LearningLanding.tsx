'use client';

import Link from 'next/link';
import { activities, isSessionComplete, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';

export function LearningLanding({ group }: { group?: 'Learn' | 'Review' }) {
  const sessions = useLearningSessions();
  const last = activities.find(activity => activity.id === sessions.last);
  const resumable = last && !isSessionComplete(last.id, sessions);
  if (!group) return <section className={styles.landing}>
    <header className={styles.landingIntro}><h1>Your learning room</h1><p>Explore an idea. Put it into practice. Come back and see what you recall.</p></header>
    <div className={styles.pathways}>
      <section><h2>Learn</h2><p>Build understanding with a reference beside you, then work on a short passage.</p><Link href="/learn/explore" className={resumable ? styles.landingLink : styles.primary}>Go to Learn <span aria-hidden="true">→</span></Link></section>
      <section><h2>Review</h2><p>Try what you remember. Answer first, or play through before seeing feedback.</p><Link href="/learn/review" className={styles.landingLink}>Go to Review <span aria-hidden="true">→</span></Link></section>
    </div>
    {resumable && <div className={styles.resumeRow}><div><h2>Pick up where you left off</h2><p>{last.group} · {last.title}</p></div><Link href={last.href} className={styles.primary} aria-label={`Resume ${last.group} ${last.title.toLowerCase()}`}>Resume <span aria-hidden="true">→</span></Link></div>}
  </section>;
  const choices = activities.filter(activity => activity.group === group);
  const preferred = choices.find(activity => activity.id === sessions.last) ?? choices[0];
  return <section className={styles.landing}>
    <header className={styles.landingIntro}><h1>{group}</h1><p>{group === 'Learn' ? 'Explore with support, then put the idea into your hands.' : 'Recall first. Look back after your attempt.'}</p></header>
    <div className={styles.activityChoices}>{choices.map(activity => {
      const complete = isSessionComplete(activity.id, sessions);
      const action = complete ? group === 'Review' ? 'Review again' : 'Practice again' : sessions.started[activity.id] ? 'Resume' : 'Start';
      return <section key={activity.id}><div><h2>{activity.title}</h2><p>{activity.description}</p>{sessions.started[activity.id] && <span className={styles.sessionNote}>{complete ? 'Completed in this preview' : 'Session in progress'}</span>}</div><Link href={activity.href} onClick={() => { if (complete) sessions.restart(activity.id); }} className={preferred.id === activity.id ? styles.primary : styles.landingLink} aria-label={`${action} ${group} ${activity.title.toLowerCase()}`}>{action} <span aria-hidden="true">→</span></Link></section>;
    })}</div>
  </section>;
}
