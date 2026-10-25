'use client';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { MasteryGraphHome } from './graph/MasteryGraphHome';
import { contextualActivity, goalActivities } from './graph/prepared';
import { isSessionComplete, useLearningSessions, type ActivityId } from './LearningSessions';
import { allPassed, loadProgress } from './theory';
import styles from './learning.module.css';
const onStorage = (l: () => void) => { window.addEventListener('storage', l); return () => window.removeEventListener('storage', l); };
export function LearningLanding() {
  const sessions = useLearningSessions(), router = useRouter();
  // /learn/understand is the encoding sandbox (#801), which keeps its own progress on the device: passing all its gates
  // finishes the first activity. The server has no storage, so it says not yet; the client reads it after hydrating.
  const theoryPassed = useSyncExternalStore(onStorage, () => allPassed(loadProgress().attempts), () => false);
  const done = (id: ActivityId) => isSessionComplete(id, sessions) || (id === 'learn-theory' && theoryPassed);
  // The first of the goal's activities not yet finished; once all are, the first again.
  const next = goalActivities.find(a => !done(a.activityId));
  const prepared = next ?? goalActivities[0];
  const target = contextualActivity(prepared.action)!;
  const complete = !next;
  function openPreparedActivity() {
    if (complete) sessions.restart(target.activity.id);
    router.push(target.activity.href);
  }
  return <div className={styles.graphHome}><MasteryGraphHome guide={{ activity:prepared,href:target.activity.href,complete,actionLabel:complete ? 'Start again' : sessions.started[target.activity.id] ? 'Resume' : 'Start',onStart:openPreparedActivity }}/></div>;
}
