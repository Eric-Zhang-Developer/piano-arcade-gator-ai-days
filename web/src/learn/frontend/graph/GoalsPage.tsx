'use client';
import { useEffect, useMemo, useState } from 'react';
import { kitButton } from '../../../game/duo-tokens';
import { DuoScope } from '../duo';
import { curriculum } from '../mastery/curriculum';
import { learnerId } from '../mastery/diagnostic/learner';
import { remoteStore } from '../mastery/remote';
import type { Attempt } from '../mastery/schema';
import { GoalPicker } from './GoalPicker';
import { songMilestone, songTitle } from './song-titles';
import { paint, toggleGoal } from './student';
import styles from './graph.module.css';

type Loaded = { learner: string; attempts: readonly Attempt[]; songIds: readonly string[] };
const store = remoteStore();
const songs = new Map(curriculum.songs.map(song => [song.songId, song]));

/** The student's goal songs as milestones, replayed from their attempts; the only place goals change. */
export function GoalsPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null), [unread, setUnread] = useState(false), [unsaved, setUnsaved] = useState(false);
  useEffect(() => {
    let live = true;
    learnerId().then(learner => Promise.all([store.list(learner), store.getGoals(learner)])
      .then(([attempts, goals]) => { if (live) setLoaded({ learner, attempts, songIds: goals.songIds }); }))
      .catch(() => { if (live) setUnread(true); });
    return () => { live = false; };
  }, []);
  const colours = useMemo(() => paint(curriculum, loaded?.attempts ?? []), [loaded]);
  async function toggle(songId: string) {
    if (!loaded) return;
    const before = loaded.songIds, songIds = toggleGoal(before, songId);
    setLoaded({ ...loaded, songIds }); setUnsaved(false);
    const saved = await store.setGoals(loaded.learner, { songIds: [...songIds] }).catch(() => false);
    if (!saved) { setLoaded(current => current && { ...current, songIds: before }); setUnsaved(true); }
  }
  const change = kitButton('secondary');
  return <DuoScope className={styles.goals} aria-busy={!loaded && !unread}>
    <div className={styles.goalsColumn}>
      <h1>Goals</h1>
      {/* Progress that can't be read says so: a milestone is never shown as zero from missing evidence. */}
      {unread && <p className={styles.alert} role="alert">Your goals and progress could not be read on this device.</p>}
      {loaded && (loaded.songIds.length
        ? <ul className={styles.milestones}>{loaded.songIds.map(songId => {
          const song = songs.get(songId), milestone = song ? songMilestone(song, colours) : null;
          return <li key={songId} className={styles.milestone} data-done={!!milestone && milestone.total > 0 && milestone.mastered === milestone.total}>
            <h2>{songTitle(songId)}</h2>
            <p>{milestone && milestone.total ? `${milestone.mastered} of ${milestone.total} skills mastered` : 'No skills tagged yet'}</p>
          </li>;
        })}</ul>
        : <p className={styles.note}>No goal songs yet. Pick up to three, and your next steps aim at them.</p>)}
      {loaded && <details className={styles.change} open={!loaded.songIds.length || undefined}>
        <summary className={change.className} style={change.style}>Change goals</summary>
        <GoalPicker chosen={loaded.songIds} onToggle={toggle}/>
      </details>}
      {unsaved && <p className={styles.alert} role="alert">That change could not be saved. Your goals are as shown.</p>}
    </div>
  </DuoScope>;
}
