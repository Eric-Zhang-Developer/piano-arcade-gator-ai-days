'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { inkCue } from '../ink/cue';
import { music, passageBeats, targetTempo } from './model';
import { Score, ScoreSource } from './Score';
import { useLearningSessions } from '../LearningSessions';
import { usePlayback } from './usePlayback';
import { useKeepFocus } from './TakeParts';
import styles from './playing.module.css';

export function PracticeWorkspace() {
  const { practice: state, dispatchPractice: dispatch } = useLearningSessions();
  const [demo, setDemo] = useState(false);
  const playback = usePlayback();
  const actions = useKeepFocus();
  useEffect(() => () => { setDemo(false); dispatch({ type: 'stop' }); }, [dispatch]);
  const locked = state.busy || demo;
  async function hear() {
    if (locked) return;
    setDemo(true);
    try { await playback.start({ tempo: state.tempo, beats: passageBeats, sound: true, onEnd: () => setDemo(false) }); }
    catch { setDemo(false); dispatch({ type: 'error', message: 'Audio could not start. Try the demo again, or continue silently.' }); }
  }
  async function take() {
    if (locked) return;
    dispatch({ type: 'start' });
    const tempo = state.stage === 'fade' && !state.hints ? targetTempo : state.tempo;
    try { await playback.start({ tempo, beats: passageBeats, sound: false, onEnd: () => dispatch({ type: 'finish' }) }); }
    catch { dispatch({ type: 'error', message: 'The preview could not start. Try again.' }); }
  }
  // Nothing here is judged (#946), so the ink hears only the student moving on.
  function onward(type: 'drill' | 'repeat') { inkCue({ kind: 'next' }); dispatch({ type }); }
  function stop() { playback.stop(); setDemo(false); dispatch({ type: 'stop' }); }
  // #946: the take is a sample learner's, never the player's: nothing is heard, so nothing here describes their playing.
  const instruction = state.busy ? ['An example take', 'Follow the score while a sample learner plays both bars. Nothing you play is heard.']
    : state.stage === 'feedback' ? ['Let the last G ring', 'In that example take the ending was cut short. Hold the G in bar 2 for two full beats.']
    : state.stage === 'drill' ? ['Give G two full beats', `Play the opening two bars on your piano. Count “one, two” on the final G. ${state.repetitions} of 4 repetitions.`]
    : state.stage === 'fade' ? state.hints ? ['Read from the staff', 'The next example removes note names. Keep the score in view.'] : state.tempo < targetTempo ? ['Bring it up to tempo', `The next example runs at ${targetTempo} bpm.`] : ['Keep the ending steady', 'Play both bars once more.']
    : state.stage === 'complete' ? ['Connect the whole melody', 'The practice example is complete. Return to your learning map.']
    : ['Give the ending room', 'Play the opening two bars. Hold the final G for two full beats.'];
  const takeLabel = state.stage === 'fade' ? state.hints ? 'Example without note names' : state.tempo < targetTempo ? `Example at ${targetTempo} bpm` : 'See an example take' : 'See an example take';
  return <section className={styles.workspace} aria-label="Guided practice">
    <div className={styles.stage} aria-busy={locked}>
      <header className={styles.header}><div><h1>{music.title}</h1></div></header>
      <div className={styles.scoreArea}><Score beat={playback.beat} hints={state.hints} /><ScoreSource /></div>
    </div>
    <aside className={styles.guide} aria-label="Current practice step">
      <div className={styles.guideBody}>
        {/* An error takes the instruction's place, so the step reads as one heading and one line. */}
        <div aria-live="polite"><h2>{instruction[0]}</h2>{state.error ? <p role="alert" className={styles.error}>{state.error}</p> : <p>{instruction[1]}</p>}</div>
      </div>
      <div className={styles.actions} ref={actions}>
        {locked ? <button type="button" className={styles.secondary} onClick={stop}>Stop {demo ? 'demo' : 'example'}</button>
          : state.stage === 'feedback' ? <button type="button" className={styles.primary} onClick={() => onward('drill')}>Practise the held note</button>
          : state.stage === 'drill' ? <button type="button" className={styles.primary} onClick={() => onward('repeat')}>I played it</button>
          : state.stage === 'complete' ? <Link className={styles.primary} href="/learn" onClick={() => inkCue({ kind: 'next' })}>Back to map</Link>
          : <button type="button" className={styles.primary} onClick={take}>{takeLabel}</button>}
        {!locked && state.stage !== 'complete' && <button type="button" className={styles.secondary} onClick={hear}>Hear the opening</button>}
      </div>
    </aside>
  </section>;
}
