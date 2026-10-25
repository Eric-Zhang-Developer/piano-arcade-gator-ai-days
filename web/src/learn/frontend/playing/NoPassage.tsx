import Link from 'next/link';
import styles from './playing.module.css';

/** A node link that leads nowhere playable: an unknown id, or a node with no passage to play. */
export function NoPassage({ id }: { id?: string }) {
  return <section className={styles.workspace} aria-label="No passage">
    <div className={styles.stage}>
      <header className={styles.header}><div><h1>Nothing to play</h1></div></header>
    </div>
    <aside className={styles.guide}>
      <div className={styles.guideBody}>
        <p>{id ? <>The map has no passage for &ldquo;{id}&rdquo;. </> : null}Pick a skill on the map to play it.</p>
      </div>
      <div className={styles.actions}><Link className={styles.primary} href="/learn">Back to map</Link></div>
    </aside>
  </section>;
}
