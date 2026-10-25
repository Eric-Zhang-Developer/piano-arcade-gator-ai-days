'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { kitButton } from '../../game/duo-tokens';
import { DuoScope } from './duo';
import { GoalPicker } from './graph/GoalPicker';
import { MasteryGraphHome } from './graph/MasteryGraphHome';
import { contextualActivity, goalActivities } from './graph/prepared';
import { isSessionComplete, useLearningSessions, type ActivityId } from './LearningSessions';
import { learnerId } from './mastery/diagnostic/learner';
import { remoteStore } from './mastery/remote/store';
import { toggleGoal } from './graph/student';
import { allPassed, loadProgress } from './theory';
import goalStyles from './graph/graph.module.css';
import styles from './learning.module.css';

const onStorage = (l: () => void) => { window.addEventListener('storage', l); return () => window.removeEventListener('storage', l); };

/** Set once a tab has been sent to the diagnostic, so its Stop (a link back here) lands on the map, not in a loop. */
const offered = 'learn:diagnostic-offered';
function wasOffered() { try { return sessionStorage.getItem(offered) === '1'; } catch { return false; } }
function markOffered() { try { sessionStorage.setItem(offered, '1'); } catch { /* storage blocked: Stop may offer it again */ } }

export function LearningLanding() {
  const sessions = useLearningSessions(), router = useRouter();
  // A student with no evidence yet names the songs they want once, then the diagnostic: after that, the agent drives.
  const [ready, setReady] = useState(false), [onboarding, setOnboarding] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      // Evidence that can't be read shows the map: a returning student is never sent back to the diagnostic by a fault.
      const learner = wasOffered() ? null : await learnerId().catch(() => null);
      const attempts = learner ? await remoteStore().list(learner).catch(() => null) : null;
      if (!live) return;
      if (learner && attempts?.length === 0) setOnboarding(learner);
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
  if (onboarding) return <GoalOnboarding learner={onboarding} onDone={() => { markOffered(); router.replace('/learn/diagnostic'); }}/>;
  if (!ready) return <div className={styles.graphHome}/>;
  return <div className={styles.graphHome}><MasteryGraphHome guide={{ activity:prepared,href:target.activity.href,complete,actionLabel:complete ? 'Start again' : sessions.started[target.activity.id] ? 'Resume' : 'Start',onStart:openPreparedActivity }}/></div>;
}

/** The one question before the diagnostic: which songs the student wants to play, so Next can aim at them. */
function GoalOnboarding({ learner, onDone }: { learner: string; onDone: () => void }) {
  const [chosen, setChosen] = useState<readonly string[]>([]), [saving, setSaving] = useState(false), [failed, setFailed] = useState(false);
  const go = kitButton('primary');
  async function save() {
    // No goals is what the store already holds for a new student, so there is nothing to save.
    if (!chosen.length) return onDone();
    setSaving(true);
    const saved = await remoteStore().setGoals(learner, { songIds: [...chosen] }).catch(() => false);
    if (saved) return onDone();
    setSaving(false); setFailed(true);
  }
  return <DuoScope className={goalStyles.goals}>
    <div className={goalStyles.goalsColumn}>
      <h1>Which songs do you want to play?</h1>
      <GoalPicker chosen={chosen} disabled={saving} onToggle={songId => setChosen(toggleGoal(chosen, songId))}/>
      {failed && <p className={goalStyles.alert} role="alert">Your goals could not be saved. Try again, or clear them to go on without.</p>}
      <button type="button" className={`${go.className} ${goalStyles.continue}`} style={go.style} disabled={saving} onClick={save}>
        {chosen.length ? `Continue with ${chosen.length} ${chosen.length === 1 ? 'song' : 'songs'}` : 'Continue without goals'}
      </button>
    </div>
  </DuoScope>;
}
