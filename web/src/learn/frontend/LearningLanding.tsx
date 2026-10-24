'use client';
import { useRouter } from 'next/navigation';
import { MasteryGraphHome } from './graph/MasteryGraphHome';
import { contextualActivity, preparedActivity } from './graph/prepared';
import { isSessionComplete, useLearningSessions } from './LearningSessions';
import styles from './learning.module.css';
export function LearningLanding() {
  const sessions = useLearningSessions(), router = useRouter();
  const target = contextualActivity(preparedActivity.action)!;
  const complete = isSessionComplete(target.activity.id, sessions);
  function openPreparedActivity() {
    sessions.setGraphContext(target.context);
    if (complete) sessions.restart(target.activity.id);
    router.push(target.activity.href);
  }
  return <div className={styles.graphHome}><MasteryGraphHome guide={{ activity:preparedActivity,href:target.activity.href,complete,actionLabel:complete ? 'Start again' : sessions.started[target.activity.id] ? 'Resume' : 'Start',onStart:openPreparedActivity }}/></div>;
}
