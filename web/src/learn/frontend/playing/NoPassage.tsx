import Link from 'next/link';
import styles from './playing.module.css';

/** A node link that leads nowhere playable: an unknown id, or a node with no passage to play. */
export function NoPassage({ id }: { id?: string }) {
  return <section className={styles.workspace} aria-label="No passage">
    <aside className={styles.guide}>
      <div className={styles.guideBody}>
        <h2>Nothing to play</h2>
        <p>{id ? <>The map has no passage for &ldquo;{id}&rdquo;. </> : null}Pick a skill on the map to play it.</p>
      </div>
      <div className={styles.actions}><Link className={styles.primary} href="/learn">Back to map</Link></div>
    </aside>
  </section>;
}
