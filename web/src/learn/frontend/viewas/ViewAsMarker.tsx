'use client';

import { useSyncExternalStore } from 'react';
import { exitViewAs, viewingAs } from './view-as';
import styles from './view-as.module.css';

const unchanging = () => () => {};

/** Says whose /learn this is while viewing as a synthetic learner, with the way back. Nothing otherwise. */
export function ViewAsMarker() {
  // The server can't know the tab's learner, so it renders nothing and the client fills it in after hydrating.
  const id = useSyncExternalStore(unchanging, viewingAs, () => null);
  if (!id) return null;
  return <aside className={styles.marker} aria-label="Viewing as a synthetic learner">
    <span>Viewing as <b>{id}</b></span>
    <button type="button" className={styles.exit} onClick={exitViewAs}>Exit</button>
  </aside>;
}
