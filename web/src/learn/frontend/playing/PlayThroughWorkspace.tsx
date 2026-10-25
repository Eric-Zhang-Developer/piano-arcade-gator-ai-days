'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { music, totalBeats } from './model';
import { Score, ScoreSource } from './Score';
import { useLearningSessions } from '../LearningSessions';
import { usePlayback } from './usePlayback';
import { useKeepFocus } from './TakeParts';
import styles from './playing.module.css';

export function PlayThroughWorkspace() {
  const { playThrough: phase, dispatchPlayThrough: send } = useLearningSessions();
  const [count, setCount] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const playback = usePlayback();
  const { start, stop } = playback;
  const actions = useKeepFocus();
  useEffect(() => () => send('stop'), [send]);
  useEffect(() => {
    if (phase !== 'countin') return;
    let remaining = 4;
    const timer = setInterval(() => {
      remaining--;
      if (remaining > 0) setCount(remaining);
      else { clearInterval(timer); send('counted'); }
    }, 60000 / music.bpm);
    return () => clearInterval(timer);
  }, [phase, send]);
  useEffect(() => {
    if (phase !== 'playing') return;
    void start({ tempo: music.bpm, beats: totalBeats, sound: false, onEnd: () => send('finish') }).catch(() => {
      setError('The preview could not start. Try again.'); send('stop');
    });
    return stop;
  }, [phase, start, stop, send]);
  function begin() { setCount(4); setError(null); send('start'); }
  const running = phase === 'countin' || phase === 'playing';
  return <section className={styles.workspace} aria-label="Independent play-through">
    <div className={styles.stage}>
      <header className={styles.header}><div><h1>{music.title}</h1></div><span className={styles.preview}>Interactive demo</span></header>
      <div className={styles.scoreArea}><Score whole beat={phase === 'playing' ? playback.beat : -1} /><ScoreSource /></div>
    </div>
    <aside className={styles.guide} aria-label="Play-through controls">
      <div className={styles.guideBody}>
        {/* The take is a sample learner's, as on /learn/practice (#946): this page doesn't listen, so no feedback is about the player. */}
        {phase === 'ready' && <><h2>Play from start to finish</h2><p>Keep going through slips. An example take shows the flow; nothing you play is heard.</p></>}
        {phase === 'countin' && <><h2>Get ready</h2><p role="status" className={styles.count}>{count}</p></>}
        {phase === 'playing' && <><h2>Playing through</h2><p role="status">Bar {Math.min(12, Math.floor(Math.max(0, playback.beat) / 4) + 1)} of 12</p></>}
        {phase === 'result' && <><h2>Play-through complete</h2><p>In that example take the long notes ran short: keep them full length, especially at the end of each phrase.</p></>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <div className={styles.actions} ref={actions}>
        {phase === 'ready' && <button type="button" className={styles.primary} onClick={begin}>See an example take</button>}
        {running && <button type="button" className={styles.secondary} onClick={() => { stop(); send('stop'); }}>Stop example</button>}
        {phase === 'result' && <Link className={styles.primary} href="/learn">Back to map</Link>}
      </div>
    </aside>
  </section>;
}
