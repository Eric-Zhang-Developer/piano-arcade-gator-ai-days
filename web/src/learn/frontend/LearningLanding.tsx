'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { MasteryGraphHome } from './graph/MasteryGraphHome';
import { contextualActivity, goalActivities } from './graph/prepared';
import { isSessionComplete, useLearningSessions, type ActivityId } from './LearningSessions';
import { learnerId } from './mastery/diagnostic/learner';
import { remoteStore } from './mastery/remote/store';
import { allPassed, loadProgress } from './theory';
import styles from './learning.module.css';

const onStorage = (l: () => void) => { window.addEventListener('storage', l); return () => window.removeEventListener('storage', l); };

/** Set once a tab has been sent to the diagnostic, so its Stop (a link back here) lands on the map, not in a loop. */
const offered = 'learn:diagnostic-offered';
function wasOffered() { try { return sessionStorage.getItem(offered) === '1'; } catch { return false; } }
function markOffered() { try { sessionStorage.setItem(offered, '1'); } catch { /* storage blocked: Stop may offer it again */ } }

export function LearningLanding() {
  const sessions = useLearningSessions(), router = useRouter();
  // A student with no evidence yet starts in the diagnostic: the agent drives, so there is nothing to choose first.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      // Evidence that can't be read shows the map: a returning student is never sent back to the diagnostic by a fault.
      const attempts = wasOffered() ? null : await learnerId().then(id => remoteStore().list(id)).catch(() => null);
      if (!live) return;
      if (attempts?.length === 0) { markOffered(); router.replace('/learn/diagnostic'); }
      else setReady(true);
    })();
    return () => { live = false; };
  }, [router]);
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
  if (!ready) return <div className={styles.graphHome}/>;
  return <div className={styles.graphHome}><MasteryGraphHome guide={{ activity:prepared,href:target.activity.href,complete,actionLabel:complete ? 'Start again' : sessions.started[target.activity.id] ? 'Resume' : 'Start',onStart:openPreparedActivity }}/></div>;
}
