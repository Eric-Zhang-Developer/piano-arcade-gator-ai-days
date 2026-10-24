'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { music, passageBeats, targetTempo } from './model';
import { Score, ScoreSource } from './Score';
import { useLearningSessions } from '../LearningSessions';
import { usePlayback } from './usePlayback';
import styles from './playing.module.css';

export function PracticeWorkspace() {
  const { practice: state, dispatchPractice: dispatch } = useLearningSessions();
  const [demo, setDemo] = useState(false);
  const playback = usePlayback();
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
  function stop() { playback.stop(); setDemo(false); dispatch({ type: 'stop' }); }
  const instruction = state.busy ? ['Play the opening', 'Follow the score through both bars.']
    : state.stage === 'feedback' ? ['Let the last G ring', 'Example feedback: the ending was cut short. Hold the G in bar 2 for two full beats.']
    : state.stage === 'drill' ? ['Give G two full beats', 'Play the opening two bars on your piano. Count “one, two” on the final G.']
    : state.stage === 'fade' ? state.hints ? ['Read from the staff', 'The next preview removes note names. Keep the score in view.'] : state.tempo < targetTempo ? ['Bring it up to tempo', `The next preview runs at ${targetTempo} bpm.`] : ['Keep the ending steady', 'Play both bars once more.']
    : state.stage === 'complete' ? ['Connect the whole melody', 'The practice example is complete. Try a continuous play-through next.']
    : ['Give the ending room', 'Play the opening two bars. Hold the final G for two full beats.'];
  const takeLabel = state.stage === 'fade' ? state.hints ? 'Preview without note names' : state.tempo < targetTempo ? `Preview at ${targetTempo} bpm` : 'Start preview take' : 'Start preview take';
  return <section className={styles.workspace} aria-label="Guided practice">
    <div className={styles.stage} aria-busy={locked}>
      <header className={styles.header}><div><h1>{music.title}</h1><p>Opening two bars · right hand</p></div><span className={styles.preview}>Interactive demo</span></header>
      <div className={styles.tools}>
        <label className={styles.tempo}>Tempo <input aria-label="Practice tempo" name="practice-tempo" type="range" min="48" max={targetTempo} step="2" value={state.tempo} disabled={locked} onChange={(e) => dispatch({ type: 'settings', settings: { tempo: Number(e.target.value) } })} /><output>{state.tempo} bpm</output></label>
        <details className={styles.settings}><summary>Practice settings</summary><label><input type="checkbox" name="note-names" checked={state.hints} disabled={locked} onChange={(e) => dispatch({ type: 'settings', settings: { hints: e.target.checked } })} /> Show note names</label></details>
      </div>
      <div className={styles.scoreArea}><Score beat={playback.beat} hints={state.hints} /><ScoreSource /></div>
    </div>
    <aside className={styles.guide} aria-label="Current practice step">
      <div className={styles.guideBody}>
        <div aria-live="polite"><h2>{instruction[0]}</h2><p>{instruction[1]}</p></div>
        {state.stage === 'drill' && <p className={styles.repetitions}>{state.repetitions} of 4 repetitions</p>}
        {demo && <p role="status">Playing the opening…</p>}
        {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
        <details className={styles.details}><summary>About this preview{state.takes > 0 ? ` · ${state.takes} example ${state.takes === 1 ? 'take' : 'takes'}` : ''}</summary><p>No piano input is recorded or graded. Preview takes show a scripted practice flow, including example feedback and one step of support removal at a time. Repetitions are self-reported. The score stays available throughout.</p></details>
      </div>
      <div className={styles.actions}>
        {locked ? <button type="button" className={styles.secondary} onClick={stop}>Stop {demo ? 'demo' : 'preview'}</button>
          : state.stage === 'feedback' ? <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'drill' })}>Practise the held note</button>
          : state.stage === 'drill' ? <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'repeat' })}>I played it</button>
          : state.stage === 'complete' ? <Link className={styles.primary} href="/learn/play-through">Go to Play-through</Link>
          : <button type="button" className={styles.primary} onClick={take}>{takeLabel}</button>}
        {!locked && state.stage !== 'complete' && <button type="button" className={styles.secondary} onClick={hear}>Hear the opening</button>}
      </div>
    </aside>
  </section>;
}
