'use client';

import Link from 'next/link';
import { type MouseEvent, useMemo, useReducer, useRef, useState } from 'react';
import { Brackets, Button, DuoScope, Mark, Panel } from '../duo';
import { choices, recordAnswer, theoryGates, type Gate, type NodeScreen } from '../theory';
import { current, initialRetrieval, items, retrievalReducer, summary, verdict, type Item, type RetrievalEvent, type RetrievalState } from './model';
import styles from './retrieval.module.css';

/**
 * The clean retrieval test: one question at a time in one panel, with no workspace or reference
 * beside it. A checked answer is final; the end view counts only the answers given in this round, and lists the
 * questions to revisit when there are any. Next decides what comes after, so the end view only leads back to the map.
 * With a node, the test is that node's items and every checked answer is appended to the device's attempts.
 * A null node has no items to test.
 */
export function Retrieval({ initial = initialRetrieval, node }: { initial?: RetrievalState; node?: NodeScreen | null }) {
  return <DuoScope className={styles.screen}>
    <div className={styles.column}>
      <Brackets>
        <Panel style={{ padding: 40 }}>
          {node === null ? <Empty/> : <Test initial={initial} node={node}/>}
        </Panel>
      </Brackets>
    </div>
  </DuoScope>;
}

function Empty() {
  return <>
    <h1 className={styles.prompt}>No theory questions for this node</h1>
    <div className={styles.actions}><Link href="/learn" className={styles.primaryLink}>Back to map</Link></div>
  </>;
}

type Heading = React.RefObject<HTMLHeadingElement | null>;
type Round = { gates: readonly Gate[]; list: readonly Item[]; node?: NodeScreen };

function Test({ initial, node }: { initial: RetrievalState; node?: NodeScreen }) {
  const round = useMemo<Round>(() => {
    const gates = node ? [node.gate] : theoryGates;
    return { gates, list: items(gates), node };
  }, [node]);
  const [state, dispatch] = useReducer((s: RetrievalState, e: RetrievalEvent) => retrievalReducer(s, e, round.list), initial);
  const [unsaved, setUnsaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = () => requestAnimationFrame(() => heading.current?.focus());

  function check() {
    const item = current(state, round.list);
    if (round.node && item && state.selected !== null && !state.checked) {
      void recordAnswer({ nodeId: round.node.gate.id, question: item.question, choiceId: state.selected, earlier: state.attempts })
        .then(saved => { if (!saved) setUnsaved(true); });
    }
    dispatch({ type: 'check' });
  }

  return <>
    {current(state, round.list)
      ? <Question state={state} round={round} dispatch={dispatch} check={check} heading={heading} focusHeading={focusHeading}/>
      : <End state={state} round={round} heading={heading}/>}
    {unsaved && <p className={styles.note} role="status">Answers aren&apos;t being saved on this device.</p>}
  </>;
}

function Question({ state, round, dispatch, check, heading, focusHeading }: { state: RetrievalState; round: Round; dispatch: (e: RetrievalEvent) => void; check: () => void; heading: Heading; focusHeading: () => void }) {
  const item = current(state, round.list)!;
  const { question } = item;
  const result = verdict(state, round.list);
  function next(event: MouseEvent<HTMLButtonElement>) {
    // A double click on Check must not also skip the question it just checked.
    if (event.detail > 1) return;
    dispatch({ type: 'next' });
    focusHeading();
  }
  return <>
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
        ? <Button style={{ fontSize: 16 }} onClick={next}>Next</Button>
        : <Button style={{ fontSize: 16 }} disabled={state.selected === null} onClick={check}>Check</Button>}
    </div>
  </>;
}

function End({ state, round, heading }: { state: RetrievalState; round: Round; heading: Heading }) {
  if (round.node) return <>
    <h1 ref={heading} tabIndex={-1} className={styles.prompt}>Test done</h1>
    <div className={styles.actions}><Link href="/learn" className={styles.primaryLink}>Back to map</Link></div>
  </>;
  const { right, revisit, answered } = summary(state.attempts, round.gates);
  return <>
    <h1 ref={heading} tabIndex={-1} className={styles.prompt}>{right.length} of {answered} right on the first try</h1>
    {revisit.length > 0 && <>
      <h2 className={styles.subhead}>To revisit</h2>
      <ul className={styles.revisit}>{revisit.map(q => <li key={q.id}>{q.prompt}</li>)}</ul>
    </>}
    <div className={styles.actions}><Link href="/learn" className={styles.primaryLink}>Back to map</Link></div>
  </>;
}
