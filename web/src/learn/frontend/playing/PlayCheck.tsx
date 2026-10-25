'use client';
import Link from 'next/link';
import { handsOf, passageBeats, type PlayingNode } from './attempt';
import { Passage } from './Passage';
import { OffList, PianoLine, TakeCount, TakeWarnings } from './TakeParts';
import { useTake } from './useTake';
import styles from './playing.module.css';

/**
 * The cold play check: one take of a node's passage at its tempo with both hands, after a four-beat count-in, with
 * no demo and no guide keys. It ends in a pass or a fail with what was off, and appends the take as a cold `Attempt`.
 */
export function PlayCheck({ node, items, itemId }: PlayingNode & { itemId?: string }) {
  const take = useTake();
  const item = items.find((i) => i.id === itemId) ?? items[0];
  const busy = take.phase === 'countin' || take.phase === 'playing';
  const beats = Math.ceil(passageBeats(item.notes) - 1e-3);
  const hands = handsOf(item);
  const piano = take.status?.state === 'piano';
  const result = take.phase === 'result' ? take.result : null;

  const [title, line] = take.phase === 'countin' ? ['Get ready', 'Four clicks, then play.']
    : take.phase === 'playing' ? ['Play', 'Recording. Keep going to the end, even after a slip.']
    : result ? [result.verdict.pass ? 'Passed' : 'Not yet', result.verdict.pass ? 'Every note in order and in time, with no help.' : 'Here is what was off:']
    : ['Play it cold', `One take at ${item.bpm} bpm with a four-beat count-in. No demo, no guide keys.`];

  return <section className={styles.workspace} aria-label="Play check">
    <div className={styles.stage} aria-busy={busy}>
      <header className={styles.header}>
        <div>
          <h1>{node.title}</h1>
          <p>{item.prompt}</p>
          <p className={styles.meta}>{item.bpm} bpm · {beats} beats · {hands.length === 2 ? 'both hands' : `${hands[0]} hand`}</p>
        </div>
        <p className={styles.preview}>Cold check</p>
      </header>
      <div className={styles.rollArea}>
        <Passage notes={item.notes} beat={busy ? take.beat : -1} played={result ? take.played : []} />
      </div>
    </div>
    <aside className={styles.guide} aria-label="Check">
      <div className={styles.guideBody}>
        <PianoLine status={take.status} />
        <h2>{title}</h2>
        <p>{line}</p>
        <TakeCount phase={take.phase} beat={take.beat} beats={beats} />
        {result && <OffList result={result} />}
        {result && !result.verdict.pass && <p className={styles.note}>
          <Link href={`/learn/practice?node=${encodeURIComponent(node.id)}`}>Practise this passage</Link> with help, then come back for another cold take.
        </p>}
        <TakeWarnings result={result} silent={take.silent} />
      </div>
      <div className={styles.actions}>
        {busy ? <button type="button" className={styles.primary} onClick={take.stop}>Stop</button>
          : <button type="button" className={styles.primary} disabled={!piano} onClick={() => void take.start({ item, hands: 'both', bpm: item.bpm, wholeHelp: false })}>{result ? 'Try again' : 'Start check'}</button>}
        <Link className={styles.secondary} href="/learn">Back to map</Link>
      </div>
    </aside>
  </section>;
}
