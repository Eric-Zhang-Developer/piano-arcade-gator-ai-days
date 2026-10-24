'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { evaluateAnswer, questions, reviewQuestions, score, source } from './lesson';
import { PhraseScore } from './Score';
import { playPhrase } from './audio';
import styles from './learning.module.css';

type Result = { prompt: string; answer: string; outcome: ReturnType<typeof evaluateAnswer> };
export function TheoryWorkspace({ review = false }: { review?: boolean }) {
  const items = review ? reviewQuestions : questions;
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [hint, setHint] = useState(false);
  const [tab, setTab] = useState<'music' | 'page'>('music');
  const [history, setHistory] = useState<Result[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const [audioError, setAudioError] = useState('');
  const stopAudio = useRef<(() => void) | null>(null);
  const audioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { stopAudio.current?.(); if (audioTimer.current) clearTimeout(audioTimer.current); }, []);
  const done = index >= items.length;
  const question = items[Math.min(index, items.length-1)];
  const outcome = evaluateAnswer(question, answer);
  const pageAllowed = !review || checked || done;
  function listen(phrase: 1 | 2) {
    stopAudio.current?.();
    if (audioTimer.current) clearTimeout(audioTimer.current);
    if (playing === phrase) { setPlaying(null); return; }
    try { stopAudio.current = playPhrase(phrase); setPlaying(phrase); setAudioError(''); audioTimer.current = setTimeout(() => setPlaying(null), 4200); }
    catch { setAudioError('Audio could not start. Check your browser’s audio permissions, then try again.'); setPlaying(null); }
  }
  function advance() {
    if (!checked) { setChecked(true); return; }
    setHistory([...history, { prompt: question.prompt, answer, outcome }]);
    setIndex(index+1); setAnswer(''); setChecked(false); setHint(false); setTab('music');
    stopAudio.current?.(); setPlaying(null);
    requestAnimationFrame(() => questionHeading.current?.focus());
  }
  return <section className={styles.activity}>
    <header className={styles.activityHeading}><div><h1>{review ? 'Recall a sense of home' : 'Hearing a phrase come home'}</h1></div><span>{done ? 'Complete' : `${index+1} / ${items.length}`}</span></header>
    <div className={styles.studio}>
      <section className={styles.questionPane} aria-label="Current question">
        <div className={styles.questionBody}>{done ? <><h2 ref={questionHeading} tabIndex={-1}>{review ? 'Review complete.' : 'That’s the idea.'}</h2><p>{review ? `${history.filter(h=>h.outcome==='correct').length} of ${items.length} answers correct in this review.` : 'A return to the home note can help a melody feel settled.'}</p><p className={styles.muted}>This activity is local practice. It does not establish mastery or save learning progress.</p></> : <><h2 ref={questionHeading} tabIndex={-1}>{question.prompt}</h2>{question.options ? <fieldset className={styles.answers}><legend className={styles.srOnly}>Your answer</legend>{question.options.map(option => <label key={option}><input type="radio" name="answer" value={option} checked={answer===option} onChange={()=>setAnswer(option)} disabled={checked}/><span>{option}</span></label>)}</fieldset> : <label className={styles.explanation}>Your explanation<textarea id="learning-explanation" name="explanation" rows={5} value={answer} onChange={e=>setAnswer(e.target.value)} readOnly={checked} placeholder="It feels settled because…"/></label>}
          {hint && <p className={styles.hint}>{question.hint}</p>}
          {checked && <div className={styles.feedback} role="status"><strong>{outcome==='correct' ? 'Correct.' : outcome==='incorrect' ? 'Not quite.' : 'Compare your explanation.'}</strong><p>{question.explanation}</p></div>}
        </>}
        {history.length>0 && <details className={styles.history}><summary>Previous answers ({history.length})</summary>{history.map(h=><div key={h.prompt}><p>{h.prompt}</p><span>{h.answer} · {h.outcome==='correct' ? 'Correct' : h.outcome==='incorrect' ? 'Revisit' : 'Reference compared'}</span></div>)}</details>}
        </div>
        <footer className={styles.questionActions}>{done ? <Link href="/learn/practice" className={styles.primary}>Continue to practice <span aria-hidden="true">→</span></Link> : <>{!review && !checked ? <button className={styles.textButton} onClick={()=>setHint(!hint)} aria-expanded={hint}>{hint ? 'Hide hint' : 'Need a hint?'}</button> : <span/>}<button className={styles.primary} disabled={!answer.trim()} onClick={advance}>{checked ? index===items.length-1 ? 'Finish' : 'Continue' : question.options ? 'Check answer' : 'Compare answer'} <span aria-hidden="true">→</span></button></>}</footer>
      </section>
      <section className={styles.workspace} aria-label="Music and reference workspace">
        <div className={styles.workspaceTabs}><button aria-pressed={tab==='music'} onClick={()=>setTab('music')}>Music</button><button aria-pressed={tab==='page'} disabled={!pageAllowed} onClick={()=>setTab('page')}>{pageAllowed ? 'Reference' : 'Reference · after answering'}</button></div>
        <div className={styles.workspaceBody}>{tab==='music' ? <><div className={styles.paper}><header><h2>Twinkle, Twinkle, Little Star</h2><p>Traditional French melody · C major</p></header><PhraseScore phrase={1}/><PhraseScore phrase={2}/><div className={styles.audioControls}>{([1,2] as const).map(p=><button key={p} onClick={()=>listen(p)} aria-pressed={playing===p}><svg viewBox="0 0 16 16" aria-hidden="true">{playing===p ? <path d="M4 3h3v10H4zm5 0h3v10H9z"/> : <path d="M5 2l9 6-9 6z"/>}</svg>{playing===p ? 'Stop' : 'Listen to'} phrase {p}</button>)}</div>{audioError && <p role="alert">{audioError}</p>}</div><details className={styles.source}><summary>Score source and listening notes</summary><p>{/* Verbatim provenance is data, not newly claimed research. */}{sourceNote()}</p><p>Synthesized melody only. These examples explore melodic closure; they do not demonstrate the underlying harmony.</p></details></> : <article className={`${styles.paper} ${styles.reference}`}><h2>A sense of home</h2><p>In C major, C is the tonic: the note we hear as home.</p><p>Compare the two endings. Phrase 1 pauses on G. Phrase 2 returns to C. Listen for the difference between a pause and a more settled ending.</p><div className={styles.notePair}><span>Phrase 1 <b>G</b></span><span>Phrase 2 <b>C</b></span></div><h3>Melody and harmony are different clues</h3><p>A final melody note is only part of an ending. A harmonic cadence depends on the chords: an authentic cadence moves from V to I. This melody-only exercise cannot establish that harmonic relationship.</p><a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a><p className={styles.referenceNote}>Original teaching summary. The source is a reference, not a claim that the complete curriculum is implemented.</p></article>}</div>
      </section>
    </div>
  </section>;
}
function sourceNote() { return score.source; }
