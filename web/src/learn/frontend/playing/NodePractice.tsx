'use client';
import { useEffect, useState } from 'react';
import { inkCue } from '../ink/cue';
import { MAX_HELP_SHARE } from '../mastery/engine';
import { type Hands, handsOf, notesFor, type PlayingNode } from './attempt';
import { Passage, useNoteCues } from './Passage';
import { countIn, ProblemLine, takeNotes, TakeNotes, useKeepFocus } from './TakeParts';
import { useTake } from './useTake';
import styles from './playing.module.css';

const handLabel = (hands: Hands) => hands === 'both' ? 'both hands' : `${hands} hand`;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const limit = percent(MAX_HELP_SHARE);

/**
 * Practice on one node's passages, with help to hand: hear it, light the guide keys, slow the tempo or take one hand. Each take is recorded with its share of help, and only a take with at most 30% help counts.
 * The help sits behind one control, so the screen holds the passage, the take and one next step.
 */
export function NodePractice({ node, items }: PlayingNode) {
  const take = useTake();
  const actions = useKeepFocus();
  const [index, setIndex] = useState(0);
  const item = items[index];
  const [bpm, setBpm] = useState(item.bpm);
  const [hands, setHands] = useState<Hands>('both');
  const busy = take.phase === 'countin' || take.phase === 'playing' || take.phase === 'listening';
  const both = handsOf(item);
  const wholeHelp = bpm < item.bpm || hands !== 'both';
  const options = { item, hands, bpm, wholeHelp };
  const piano = take.status?.state === 'piano';
  const result = take.phase === 'result' ? take.result : null;
  // A clean take that counts moves on; Next picks the passage, so there is no list to choose from.
  const next = !!result?.verdict.pass && result.counts && index + 1 < items.length;
  useNoteCues(notesFor(item, hands), take.played);
  const scored = result?.attempt.id;
  const passed = result?.verdict.pass;
  useEffect(() => { if (scored) inkCue({ kind: passed ? 'pass' : 'fail' }); }, [scored, passed]);

  function pick(i: number) {
    take.reset();
    setIndex(i); setBpm(items[i].bpm); setHands('both');
  }

  const title = take.phase === 'listening' ? 'Listen' : take.phase === 'playing' ? 'Play'
    : result ? result.verdict.pass ? 'Clean take' : 'Not yet' : 'Practise it';
  const help = result && `Help ${percent(result.attempt.helpShare)}. Takes with more than ${limit} help don't count, so this one is practice.`;

  return <section className={styles.workspace} aria-label="Node practice">
    <div className={styles.stage} aria-busy={busy}>
      <header className={styles.header}>
        <div>
          <h1>{node.title}</h1>
          <p>{item.prompt}</p>
        </div>
      </header>
      <details className={styles.help}>
        <summary>Help</summary>
        <div className={styles.tools} role="group" aria-label="Help">
          <button type="button" className={styles.toggle} aria-pressed={take.aids.guide} onClick={() => take.setAids({ ...take.aids, guide: !take.aids.guide })}>Guide keys</button>
          <button type="button" className={styles.toggle} disabled={busy} onClick={() => void take.listen(options)}>Hear it</button>
          <label className={styles.tempo}>Tempo
            <input type="range" min={Math.round(item.bpm / 2)} max={Math.round(item.bpm)} step={1} value={bpm} disabled={busy} onChange={(e) => setBpm(Number(e.target.value))} />
            <output>{Math.round(bpm)} bpm</output>
          </label>
          {both.length === 2 && <div className={styles.segmented} role="radiogroup" aria-label="Hands">
            {(['both', 'right', 'left'] as const).map((h) => <button key={h} type="button" role="radio" aria-checked={hands === h} disabled={busy} onClick={() => setHands(h)}>{h === 'both' ? 'Both' : h === 'right' ? 'Right' : 'Left'}</button>)}
          </div>}
          {wholeHelp && <p>At {Math.round(bpm)} bpm with {handLabel(hands)}, the whole take is help, so it won&apos;t count.</p>}
        </div>
      </details>
      <div className={styles.rollArea}>
        <Passage notes={item.notes} hands={hands} beat={busy ? take.beat : -1} guide={take.aids.guide} played={take.played} down={take.down} />
      </div>
    </div>
    <aside className={styles.guide} aria-label="Take">
      <div className={styles.guideBody}>
        <ProblemLine status={take.status} silent={take.silent} quiet={!!result} />
        {/* #1276: the verdict and what was off, heard as they come; mounted before the take starts. */}
        <div aria-live="polite">
          {take.phase === 'countin' ? <h2 className={styles.count}>{countIn(take.beat)}</h2> : <h2>{title}</h2>}
          {result && <TakeNotes notes={takeNotes(result, { status: take.status, silent: take.silent, help: help || undefined })} />}
        </div>
      </div>
      <div className={styles.actions} ref={actions}>
        {busy ? <button type="button" className={styles.primary} onClick={take.stop}>Stop</button>
          : next ? <button type="button" className={styles.primary} onClick={() => { inkCue({ kind: 'next' }); pick(index + 1); }}>Next passage</button>
          : <button type="button" className={styles.primary} disabled={!piano} onClick={() => void take.start(options)}>{result ? 'Try again' : 'Start take'}</button>}
      </div>
    </aside>
  </section>;
}
