'use client';

import Link from 'next/link';
import { type MouseEvent, useReducer, useRef } from 'react';
import { Brackets, Button, DuoScope, Mark, Panel } from '../duo';
import { choices } from '../theory';
import { current, initialRetrieval, retrievalReducer, summary, theoryItems, verdict, type RetrievalEvent, type RetrievalState } from './model';
import styles from './retrieval.module.css';

/**
 * The clean retrieval test: one question at a time in one panel, with no workspace or reference
 * beside it. A checked answer is final; the end view counts only the answers given in this round.
 */
export function Retrieval({ initial = initialRetrieval }: { initial?: RetrievalState }) {
  const [state, dispatch] = useReducer((s: RetrievalState, e: RetrievalEvent) => retrievalReducer(s, e), initial);
  const heading = useRef<HTMLHeadingElement>(null);
  const item = current(state);
  const focusHeading = () => requestAnimationFrame(() => heading.current?.focus());

  return <DuoScope className={styles.screen}>
    <div className={styles.column}>
      <Brackets>
        <Panel style={{ padding: 40 }}>
          {item ? <Question state={state} dispatch={dispatch} heading={heading} focusHeading={focusHeading}/> : <End state={state} heading={heading} restart={() => { dispatch({ type: 'restart' }); focusHeading(); }}/>}
        </Panel>
      </Brackets>
    </div>
  </DuoScope>;
}

type Heading = React.RefObject<HTMLHeadingElement | null>;

function Question({ state, dispatch, heading, focusHeading }: { state: RetrievalState; dispatch: (e: RetrievalEvent) => void; heading: Heading; focusHeading: () => void }) {
  const item = current(state)!;
  const { question } = item;
  const result = verdict(state);
  const last = state.index === theoryItems.length - 1;
  function next(event: MouseEvent<HTMLButtonElement>) {
    // A double click on Check must not also skip the question it just checked.
    if (event.detail > 1) return;
    dispatch({ type: 'next' });
    focusHeading();
  }
  return <>
    <p className={styles.count}>Question {state.index + 1} of {theoryItems.length}</p>
    <h1 id="retrieval-question" ref={heading} tabIndex={-1} className={styles.prompt}>{question.prompt}</h1>
    <fieldset key={question.id} className={styles.options} aria-describedby="retrieval-question">
      <legend className={styles.hidden}>Your answer</legend>
      {choices(question).map(choice => {
        const picked = state.selected === choice.id;
        const shown = picked && result ? result : null;
        return <div key={choice.id} className={styles.option} data-picked={picked || undefined} data-verdict={shown ? (shown.correct ? 'correct' : 'wrong') : undefined}>
          <label className={styles.choice}>
            <input type="radio" name={`answer-${question.id}`} value={choice.id} checked={picked} disabled={state.checked} onChange={() => dispatch({ type: 'select', choiceId: choice.id })}/>
            <span>{choice.text}</span>
          </label>
          <div className={styles.feedback} aria-live="polite">
            {shown && <><Mark kind={shown.correct ? 'correct' : 'wrong'}/>{!shown.correct && <p>{shown.choice.explanation}</p>}</>}
          </div>
        </div>;
      })}
    </fieldset>
    <div className={styles.actions}>
      {state.checked
        ? <Button style={{ fontSize: 16 }} onClick={next}>{last ? 'See results' : 'Next'}</Button>
        : <Button style={{ fontSize: 16 }} disabled={state.selected === null} onClick={() => dispatch({ type: 'check' })}>Check</Button>}
    </div>
  </>;
}

function End({ state, heading, restart }: { state: RetrievalState; heading: Heading; restart: () => void }) {
  const { right, revisit, answered } = summary(state.attempts);
  return <>
    <p className={styles.count}>Round complete</p>
    <h1 ref={heading} tabIndex={-1} className={styles.prompt}>{right.length} of {answered} right on the first try</h1>
    <h2 className={styles.subhead}>To revisit</h2>
    {revisit.length
      ? <ul className={styles.revisit}>{revisit.map(q => <li key={q.id}>{q.prompt}</li>)}</ul>
      : <p className={styles.body}>Nothing to revisit from this round.</p>}
    <p className={styles.note}>Counted only from the answers you gave in this round.</p>
    <div className={styles.actions}>
      <Link href="/learn" className={styles.primaryLink}>Back to map</Link>
      <Button kind="secondary" style={{ fontSize: 16 }} onClick={restart}>Try again</Button>
    </div>
  </>;
}
