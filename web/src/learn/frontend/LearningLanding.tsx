'use client';
import { useRouter } from 'next/navigation';
import { MasteryGraphHome } from './graph/MasteryGraphHome';
import { contextualActivity, goalActivities } from './graph/prepared';
import { isSessionComplete, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';
export function LearningLanding() {
  const sessions = useLearningSessions(), router = useRouter();
  // The first of the goal's activities not yet finished; once all are, the first again.
  const next = goalActivities.find(a => !isSessionComplete(a.activityId, sessions));
  const prepared = next ?? goalActivities[0];
  const target = contextualActivity(prepared.action)!;
  const complete = !next;
  function openPreparedActivity() {
    if (complete) sessions.restart(target.activity.id);
    router.push(target.activity.href);
  }
  return <div className={styles.graphHome}><MasteryGraphHome guide={{ activity:prepared,href:target.activity.href,complete,actionLabel:complete ? 'Start again' : sessions.started[target.activity.id] ? 'Resume' : 'Start',onStart:openPreparedActivity }}/></div>;
}
