'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MasteryGraphHome } from './graph/MasteryGraphHome';
import { byId, type GraphAction } from './graph/data';
import { activities, isSessionComplete, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';

export function LearningLanding({ group }: { group?: 'Learn' | 'Review' }) {
  const sessions = useLearningSessions();
  const router = useRouter();
  function openGraphActivity(action: GraphAction) {
    // Only these skills have a truthful mapping to the existing Twinkle demonstrations.
    const supported = ['theory.tonal-center', 'theory.phrase-endings', 'procedure.steady-pulse', 'procedure.held-endings', 'procedure.short-phrase-coordination'];
    const skill = byId.get(action.skillId);
    if (!supported.includes(action.skillId) || !skill?.activity || skill.domain !== action.domain) return;
    const targetGroup = action.intent === 'learn' ? 'Learn' : 'Review';
    const targetTitle = action.domain === 'theory' ? 'Theory' : 'Practice';
    const activity = activities.find(item => item.group === targetGroup && item.title === targetTitle)!;
    sessions.setGraphContext({ activityId: activity.id, group: targetGroup, title: skill.title, demoActivity: skill.activity });
    router.push(targetGroup === 'Learn' ? '/learn/explore' : '/learn/review');
  }
  if (!group) return <div className={styles.graphHome}><MasteryGraphHome onAction={openGraphActivity}/></div>;
  const choices = activities.filter(activity => activity.group === group);
  const mapContext = sessions.graphContext?.group === group ? sessions.graphContext : null;
  const preferred = choices.find(activity => activity.id === mapContext?.activityId) ?? choices.find(activity => activity.id === sessions.last) ?? choices[0];
  return <section className={styles.landing}>
    <header className={styles.landingIntro}><h1>{group}</h1><p>{mapContext ? `${mapContext.title} · ${mapContext.demoActivity} (demo)` : group === 'Learn' ? 'Explore with support, then put the idea into your hands.' : 'Recall first. Look back after your attempt.'}</p></header>
    <div className={styles.activityChoices}>{choices.map(activity => {
      const complete = isSessionComplete(activity.id, sessions);
      const action = complete ? group === 'Review' ? 'Review again' : 'Practice again' : sessions.started[activity.id] ? 'Resume' : 'Start';
      return <section key={activity.id}><div><h2>{activity.title}</h2><p>{activity.description}</p>{sessions.started[activity.id] && <span className={styles.sessionNote}>{complete ? 'Completed in this preview' : 'Session in progress'}</span>}</div><Link href={activity.href} onClick={() => { if (complete) sessions.restart(activity.id); }} className={preferred.id === activity.id ? styles.primary : styles.landingLink} aria-label={`${action} ${group} ${activity.title.toLowerCase()}`}>{action} <span aria-hidden="true">→</span></Link></section>;
    })}</div>
  </section>;
}
