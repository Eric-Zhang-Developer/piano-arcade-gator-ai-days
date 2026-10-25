'use client';
import { useState } from 'react';
import { kitChip } from '../../../game/duo-tokens';
import { curriculum } from '../mastery/curriculum';
import { songPages, songTitle } from './song-titles';
import { maxGoals } from './student';
import styles from './graph.module.css';

const pages = songPages(curriculum.songs);

type Props = { chosen: readonly string[]; disabled?: boolean; onToggle: (songId: string) => void };

/** The library one page at a time, fewest skills first, so choosing a goal never means reading forty titles at once. */
export function GoalPicker({ chosen, disabled = false, onToggle }: Props) {
  const [index, setIndex] = useState(0);
  const page = pages[index];
  if (!page) return <p className={styles.note}>No songs are tagged in the curriculum yet.</p>;
  return <div className={styles.picker}>
    <fieldset className={styles.songPage}>
      <legend>Pick up to {maxGoals} · songs with {page.fewest === page.most ? page.fewest : `${page.fewest} to ${page.most}`} skills</legend>
      <ul>{page.songs.map(song => {
        const lit = chosen.includes(song.songId), chip = kitChip(lit);
        return <li key={song.songId}><button type="button" className={chip.className} style={{ ...chip.style, fontSize: 16 }} aria-pressed={lit} disabled={disabled || (!lit && chosen.length >= maxGoals)} onClick={() => onToggle(song.songId)}>{songTitle(song.songId)}</button></li>;
      })}</ul>
    </fieldset>
    <div className={styles.pager}>
      <button type="button" className={styles.pageTurn} disabled={index === 0} onClick={() => setIndex(index - 1)}><span aria-hidden="true">← </span>Fewer skills</button>
      <button type="button" className={styles.pageTurn} disabled={index === pages.length - 1} onClick={() => setIndex(index + 1)}>More skills<span aria-hidden="true"> →</span></button>
    </div>
  </div>;
}
