'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { music, totalBeats } from './model';
import { Score, ScoreSource } from './Score';
import { useLearningSessions } from '../LearningSessions';
import { usePlayback } from './usePlayback';
import styles from './playing.module.css';

export function PlayThroughWorkspace() {
  const { playThrough: phase, dispatchPlayThrough: send } = useLearningSessions();
  const [count, setCount] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const playback = usePlayback();
  const { start, stop } = playback;
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
      <header className={styles.header}><div><h1>{music.title}</h1><p>Whole melody · right hand · {music.bpm} bpm</p></div><span className={styles.preview}>Interactive demo</span></header>
      <div className={styles.scoreArea}><Score whole beat={phase === 'playing' ? playback.beat : -1} /><ScoreSource /></div>
    </div>
    <aside className={styles.guide} aria-label="Play-through controls">
      <div className={styles.guideBody}>
        {phase === 'ready' && <><h2>Play from start to finish</h2><p>Keep going through slips. Feedback comes after the last bar.</p></>}
        {phase === 'countin' && <><h2>Get ready</h2><p role="status" className={styles.count}>{count}</p></>}
        {phase === 'playing' && <><h2>Playing through</h2><p role="status">Bar {Math.min(12, Math.floor(Math.max(0, playback.beat) / 4) + 1)} of 12</p></>}
        {phase === 'result' && <><h2>Play-through complete</h2><p>Example feedback: keep the long notes full length, especially at the end of each phrase.</p><details className={styles.details}><summary>What this example shows</summary><p>A scripted result for this melody with the score at {music.bpm} bpm. No performance was recorded or assessed. Playing from memory, retention after a delay and transfer to new music are untested.</p></details></>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {!running && <details className={styles.details}><summary>About this preview</summary><p>A silent playhead demonstrates a full take. You can play along on your piano; this preview does not listen. No hints or corrective coaching appear during the take.</p></details>}
      </div>
      <div className={styles.actions}>
        {phase === 'ready' && <button type="button" className={styles.primary} onClick={begin}>Start preview take</button>}
        {running && <button type="button" className={styles.secondary} onClick={() => { stop(); send('stop'); }}>Stop preview</button>}
        {phase === 'result' && <><Link className={styles.primary} href="/learn/practice">Practise the phrase ending</Link><button type="button" className={styles.secondary} onClick={() => send('again')}>Play again</button></>}
      </div>
    </aside>
  </section>;
}
