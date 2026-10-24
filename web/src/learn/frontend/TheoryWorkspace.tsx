'use client';

import Link from 'next/link';
import Image from 'next/image';
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { evaluateAnswer, questions, reviewQuestions, score, source } from './lesson';
import { PhraseScore } from './Score';
import { useTheorySession } from './LearningSessions';
import { playPhrase } from './audio';
import styles from './learning.module.css';

export function TheoryWorkspace({ review = false, guide }: { review?: boolean; guide?: { instruction: string; imageSrc?: string } }) {
  const guided = Boolean(guide);
  const items = review ? reviewQuestions : questions;
  const { state, update, setPaneWidth } = useTheorySession(review);
  const { index, answer, checked, hint, tab, history, paneWidth } = state;
  const [playing, setPlaying] = useState<number | null>(null);
  const [audioError, setAudioError] = useState('');
  const stopAudio = useRef<(() => void) | null>(null);
  const audioTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const studio = useRef<HTMLDivElement>(null);
  const questionBody = useRef<HTMLDivElement>(null);
  const materialBody = useRef<HTMLDivElement>(null);
  const materialScroll = useRef({ music: 0, page: 0 });
  // A restored guided session opens at its current prompt, with earlier answers
  // still available above it in this pane. Keep the workspace/page stationary.
  useLayoutEffect(() => {
    if (!guided) return;
    const pane = questionBody.current, heading = questionHeading.current;
    if (pane && heading) pane.scrollTop = Math.max(0, pane.scrollTop + heading.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24);
  }, [guided, index]);
  useEffect(() => {
    materialBody.current?.scrollTo({ top: materialScroll.current[tab] });
  }, [tab]);
  const [paneBounds, setPaneBounds] = useState({ min: 30, max: 65 });
  useEffect(() => {
    const element = studio.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;
      if (!width) return;
      const min = 330 / width * 100, max = (width - 431) / width * 100;
      setPaneBounds({ min, max });
      setPaneWidth(current => Math.min(max, Math.max(min, current)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [setPaneWidth]);
  function resizePane(percent: number) {
    setPaneWidth(Math.min(paneBounds.max, Math.max(paneBounds.min, percent)));
  }
  useEffect(() => () => { stopAudio.current?.(); if (audioTimer.current) clearTimeout(audioTimer.current); setPlaying(null); }, []);
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
    if (!checked) { update({ checked: true }); requestAnimationFrame(() => questionBody.current?.scrollTo({ top: questionBody.current.scrollHeight })); return; }
    update({ history: [...history, { prompt: question.prompt, answer, explanation: question.explanation, outcome }], index: index+1, answer: '', checked: false, hint: false, ...(review ? { tab: 'music' as const } : {}) });
    stopAudio.current?.(); setPlaying(null);
    requestAnimationFrame(() => { questionHeading.current?.focus(); questionBody.current?.scrollTo({ top: questionBody.current.scrollHeight }); });
  }
  return <section className={styles.theoryActivity}>
    <div ref={studio} className={styles.theoryStudio} style={{ '--question-width': `${paneWidth}%` } as CSSProperties}>
      <section className={styles.questionPane} aria-label="Current question">
        <header className={styles.lessonFocus}>
          {guide ? <div className={styles.tutorHeading}><Image data-tutor-perch src={guide.imageSrc ?? "/learning/companion-gator.svg"} alt="Your gator guide" width={56} height={56} unoptimized/><h1 tabIndex={-1}>{review ? 'Recall a sense of home' : 'Hearing a phrase come home'}</h1></div> : <h1>{review ? 'Recall a sense of home' : 'Hearing a phrase come home'}</h1>}
          <p>{guide?.instruction ?? (review ? 'Review theory · Try each answer before opening the reference.' : 'Learn theory · Explore with the score and reference.')}</p>
          <span>{done ? 'Complete' : `Question ${index+1} of ${items.length}`}</span>
        </header>
        <div ref={questionBody} className={styles.questionBody}>
          {history.length>0 && <div className={styles.answerHistory} aria-label="Previous answers"><p>Previous answers ({history.length})</p>{history.map(h=><article key={h.prompt}><h2>{h.prompt}</h2><p className={styles.studentAnswer}>Your answer: {h.answer}</p><p><strong>{h.outcome==='correct' ? 'Correct.' : h.outcome==='incorrect' ? 'Revisit this.' : 'Reference compared.'}</strong> {h.explanation}</p></article>)}</div>}
          {done ? <><h2 ref={questionHeading} tabIndex={-1}>{review ? 'Review complete.' : 'That’s the idea.'}</h2><p>{review ? `${history.filter(h=>h.outcome==='correct').length} of ${items.length} answers correct in this review.` : 'A return to the home note can help a melody feel settled.'}</p><p className={styles.muted}>This activity is local practice. It does not establish mastery or save learning progress.</p></> : <>
            <h2 id="current-question" ref={questionHeading} tabIndex={-1}>{question.prompt}</h2>
            {hint && <p className={styles.hint}>{question.hint}</p>}
            {checked && <div className={styles.feedback} role="status"><strong>{outcome==='correct' ? 'Correct.' : outcome==='incorrect' ? 'Not quite.' : 'Compare your explanation.'}</strong><p>{question.explanation}</p></div>}
          </>}
        </div>
        <div className={styles.answerComposer}>
          {!done && (question.options ? <fieldset className={styles.answers} aria-describedby="current-question"><legend>Your answer</legend>{question.options.map(option => <label key={option}><input type="radio" name="answer" value={option} checked={answer===option} onChange={()=>update({ answer: option })} disabled={checked}/><span>{option}</span></label>)}</fieldset> : <label className={styles.explanation}>Your explanation<textarea id="learning-explanation" name="explanation" rows={3} value={answer} onChange={e=>update({ answer: e.target.value })} readOnly={checked} aria-describedby="current-question" placeholder="It feels settled because…"/></label>)}
          <footer className={styles.questionActions}>{done ? <Link href="/learn" className={styles.primary}>Back to map <span aria-hidden="true">→</span></Link> : <>{!review && !checked ? <button className={styles.textButton} onClick={()=>update({ hint: !hint })} aria-expanded={hint}>{hint ? 'Hide hint' : 'Need a hint?'}</button> : <span/>}<button className={styles.primary} disabled={!answer.trim()} onClick={advance}>{checked ? index===items.length-1 ? 'Finish' : 'Continue' : question.options ? 'Check answer' : 'Compare answer'} <span aria-hidden="true">→</span></button></>}</footer>
        </div>
      </section>
      <div role="separator" aria-label="Resize question pane" aria-orientation="vertical" aria-valuemin={Math.round(paneBounds.min)} aria-valuemax={Math.round(paneBounds.max)} aria-valuenow={Math.round(paneWidth)} tabIndex={0} className={styles.paneDivider}
        onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); resizePane(paneWidth + (event.key === 'ArrowLeft' ? -2 : 2)); } }}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId) && studio.current) { const rect = studio.current.getBoundingClientRect(); resizePane((event.clientX - rect.left) / rect.width * 100); } }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />
      <section className={styles.workspace} aria-label="Music and reference workspace">
        <div className={styles.workspaceTabs}><button aria-pressed={tab==='music'} onClick={()=>update({ tab: 'music' })}>Music</button><button aria-pressed={tab==='page'} disabled={!pageAllowed} onClick={()=>update({ tab: 'page' })}>{pageAllowed ? 'Reference' : 'Reference · after answering'}</button></div>
        <div ref={materialBody} className={styles.workspaceBody} onScroll={event => { materialScroll.current[tab] = event.currentTarget.scrollTop; }}>{tab==='music' ? <><div className={styles.paper}><header><h2>Twinkle, Twinkle, Little Star</h2><p>Traditional French melody · C major</p></header><PhraseScore phrase={1} active={playing===1}/><PhraseScore phrase={2} active={playing===2}/><div className={styles.audioControls}>{([1,2] as const).map(p=><button key={p} onClick={()=>listen(p)} aria-pressed={playing===p}><svg viewBox="0 0 16 16" aria-hidden="true">{playing===p ? <path d="M4 3h3v10H4zm5 0h3v10H9z"/> : <path d="M5 2l9 6-9 6z"/>}</svg>{playing===p ? 'Stop' : 'Listen to'} phrase {p}</button>)}</div>{audioError && <p role="alert">{audioError}</p>}</div><details className={styles.source}><summary>Score source and listening notes</summary><p>{/* Verbatim provenance is data, not newly claimed research. */}{sourceNote()}</p><p>Synthesized melody only. These examples explore melodic closure; they do not demonstrate the underlying harmony.</p></details></> : <article className={`${styles.paper} ${styles.reference}`}><h2>A sense of home</h2><p>In C major, C is the tonic: the note we hear as home.</p><p>Compare the two endings. Phrase 1 pauses on G. Phrase 2 returns to C. Listen for the difference between a pause and a more settled ending.</p><div className={styles.notePair}><span>Phrase 1 <b>G</b></span><span>Phrase 2 <b>C</b></span></div><h3>Melody and harmony are different clues</h3><p>A final melody note is only part of an ending. A harmonic cadence depends on the chords: an authentic cadence moves from V to I. This melody-only exercise cannot establish that harmonic relationship.</p><a href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a><p className={styles.referenceNote}>Original teaching summary. The source is a reference, not a claim that the complete curriculum is implemented.</p></article>}</div>
      </section>
    </div>
  </section>;
}
function sourceNote() { return score.source; }
