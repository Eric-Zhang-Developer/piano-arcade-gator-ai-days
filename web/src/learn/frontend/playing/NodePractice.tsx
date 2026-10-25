'use client';
import Link from 'next/link';
import { useState } from 'react';
import { MAX_HELP_SHARE } from '../mastery/engine';
import type { Hand } from '../mastery/schema';
import { type Hands, handsOf, notesFor, passageBeats, type PlayingNode } from './attempt';
import { Passage } from './Passage';
import { OffList, PianoLine, TakeCount, TakeWarnings } from './TakeParts';
import { useTake } from './useTake';
import styles from './playing.module.css';

const handLabel = (hands: readonly Hand[] | Hands) => typeof hands === 'string' ? hands === 'both' ? 'both hands' : `${hands} hand` : hands.length === 2 ? 'both hands' : `${hands[0]} hand`;
const percent = (share: number) => `${Math.round(share * 100)}%`;
const limit = percent(MAX_HELP_SHARE);

/**
 * Practice on one node's passages, with help to hand: hear the demo, light the guide keys, slow the tempo or take one
 * hand. Each take is recorded with its share of help, and only a take with at most 30% help counts.
 */
export function NodePractice({ node, items }: PlayingNode) {
  const take = useTake();
  const [index, setIndex] = useState(0);
  const item = items[index];
  const [bpm, setBpm] = useState(item.bpm);
  const [hands, setHands] = useState<Hands>('both');
  const busy = take.phase === 'countin' || take.phase === 'playing' || take.phase === 'listening';
  const both = handsOf(item);
  const notes = notesFor(item, hands);
  const beats = Math.ceil(passageBeats(notes) - 1e-3);
  const wholeHelp = bpm < item.bpm || hands !== 'both';
  const options = { item, hands, bpm, wholeHelp };
  const piano = take.status?.state === 'piano';
  const result = take.phase === 'result' ? take.result : null;

  function pick(i: number) {
    take.reset();
    setIndex(i); setBpm(items[i].bpm); setHands('both');
  }

  const [title, line] = take.phase === 'listening' ? ['Listen', `The demo plays once at ${bpm} bpm.`]
    : take.phase === 'countin' ? ['Get ready', 'Four clicks, then play.']
    : take.phase === 'playing' ? ['Play', 'Recording. Keep going to the end, even after a slip.']
    : result ? [result.verdict.pass ? 'Clean take' : 'Not yet', result.verdict.pass ? 'Every note in order and in time.' : 'Here is what was off:']
    : ['Practise it', 'Play the passage on your piano after a four-beat count-in. Hear the demo first, or turn on help while you play.'];

  return <section className={styles.workspace} aria-label="Node practice">
    <div className={styles.stage} aria-busy={busy}>
      <header className={styles.header}>
        <div>
          <h1>{node.title}</h1>
          <p>{item.prompt}</p>
          <p className={styles.meta}>Passage {index + 1} of {items.length} · {item.bpm} bpm · {handLabel(both)}</p>
        </div>
        {items.length > 1 && <nav className={styles.tabs} aria-label="Passages">
          {items.map((it, i) => <button key={it.id} type="button" aria-current={i === index ? 'step' : undefined} disabled={busy} onClick={() => pick(i)}>{i + 1}</button>)}
        </nav>}
      </header>
      <div className={styles.tools} role="group" aria-label="Help">
        <button type="button" className={styles.toggle} aria-pressed={take.aids.demo} onClick={() => take.setAids({ ...take.aids, demo: !take.aids.demo })}>Demo</button>
        <button type="button" className={styles.toggle} aria-pressed={take.aids.guide} onClick={() => take.setAids({ ...take.aids, guide: !take.aids.guide })}>Guide keys</button>
        <label className={styles.tempo}>Tempo
          <input type="range" min={Math.round(item.bpm / 2)} max={Math.round(item.bpm)} step={1} value={bpm} disabled={busy} onChange={(e) => setBpm(Number(e.target.value))} />
          <output>{Math.round(bpm)} bpm</output>
        </label>
        {both.length === 2 && <div className={styles.segmented} role="radiogroup" aria-label="Hands">
          {(['both', 'right', 'left'] as const).map((h) => <button key={h} type="button" role="radio" aria-checked={hands === h} disabled={busy} onClick={() => setHands(h)}>{h === 'both' ? 'Both' : h === 'right' ? 'Right' : 'Left'}</button>)}
        </div>}
      </div>
      <div className={styles.rollArea}>
        <Passage notes={item.notes} hands={hands} beat={busy ? take.beat : -1} guide={take.aids.guide} played={take.played} down={take.down} />
      </div>
    </div>
    <aside className={styles.guide} aria-label="Take">
      <div className={styles.guideBody}>
        <PianoLine status={take.status} />
        <h2>{title}</h2>
        <p>{line}</p>
        <TakeCount phase={take.phase} beat={take.beat} beats={beats} />
        {result && <>
          <OffList result={result} />
          <p className={styles.verdictLine} data-counts={result.counts}>
            {result.counts ? `Help ${percent(result.attempt.helpShare)}. This take counts.` : `Help ${percent(result.attempt.helpShare)}. Takes with more than ${limit} help don't count, so this one is practice.`}
          </p>
        </>}
        {!busy && !result && <p className={styles.note}>
          {wholeHelp ? `At ${Math.round(bpm)} bpm with ${handLabel(hands)}, the whole take is help, so it won't count. ` : ''}
          A take counts when help covers at most {limit} of it.
        </p>}
        <TakeWarnings result={result} silent={take.silent} />
      </div>
      <div className={styles.actions}>
        {busy ? <button type="button" className={styles.primary} onClick={take.stop}>Stop</button> : <>
          <button type="button" className={styles.primary} disabled={!piano} onClick={() => void take.start(options)}>{result ? 'Try again' : 'Start take'}</button>
          <button type="button" className={styles.secondary} onClick={() => void take.listen(options)}>Hear it</button>
          {index + 1 < items.length && result?.verdict.pass && <button type="button" className={styles.secondary} onClick={() => pick(index + 1)}>Next passage</button>}
        </>}
        <Link className={styles.secondary} href="/learn">Back to map</Link>
      </div>
    </aside>
  </section>;
}
