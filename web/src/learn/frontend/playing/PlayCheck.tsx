'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { inkCue } from '../ink/cue';
import type { PlayingNode } from './attempt';
import { Passage, useNoteCues } from './Passage';
import { countIn, ProblemLine, takeNotes, TakeNotes } from './TakeParts';
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
  const piano = take.status?.state === 'piano';
  const result = take.phase === 'result' ? take.result : null;
  useNoteCues(item.notes, take.played);
  const scored = result?.attempt.id;
  const passed = result?.verdict.pass;
  useEffect(() => { if (scored) inkCue({ kind: passed ? 'pass' : 'fail' }); }, [scored, passed]);

  const title = take.phase === 'playing' ? 'Play' : result ? result.verdict.pass ? 'Passed' : 'Not yet' : 'Play it cold';

  return <section className={styles.workspace} aria-label="Play check">
    <div className={styles.stage} aria-busy={busy}>
      <header className={styles.header}>
        <div>
          <h1>{node.title}</h1>
          <p>{item.prompt}</p>
        </div>
      </header>
      <div className={styles.rollArea}>
        <Passage notes={item.notes} beat={busy ? take.beat : -1} played={result ? take.played : []} />
      </div>
    </div>
    <aside className={styles.guide} aria-label="Check">
      <div className={styles.guideBody}>
        <ProblemLine status={take.status} silent={take.silent} quiet={!!result} />
        {/* #1276: the verdict and what was off, heard as they come; mounted before the take starts. */}
        <div aria-live="polite">
          {take.phase === 'countin' ? <h2 className={styles.count}>{countIn(take.beat)}</h2> : <h2>{title}</h2>}
          {result && <TakeNotes notes={takeNotes(result, { status: take.status, silent: take.silent })} />}
        </div>
        {result && !result.verdict.pass && <p className={styles.note}>
          <Link href={`/learn/practice?node=${encodeURIComponent(node.id)}`} onClick={() => inkCue({ kind: 'next' })}>Practise this passage</Link> with help, then come back for another cold take.
        </p>}
      </div>
      <div className={styles.actions}>
        {busy ? <button type="button" className={styles.primary} onClick={take.stop}>Stop</button>
          : <button type="button" className={styles.primary} disabled={!piano} onClick={() => void take.start({ item, hands: 'both', bpm: item.bpm, wholeHelp: false })}>{result ? 'Try again' : 'Start check'}</button>}
      </div>
    </aside>
  </section>;
}
