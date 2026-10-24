"use client";
// The music select (/): the focused song large on the left, the song cards on the right. Each card is a link, so
// click and Enter play natively; ↑/↓ move focus and keep the focused card centered in the list.
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { SongCard } from "../song-card";
import { SongJacket } from "../song-jacket/SongJacket";
import type { Song } from "../song-select/load";
import styles from "./select-layout.module.css";

export function MusicSelect({ songs }: { songs: Song[] }) {
  const [focused, setFocused] = useState(0);
  const song = songs[focused];

  function onKeyDown(e: KeyboardEvent<HTMLOListElement>) {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const links = [...e.currentTarget.querySelectorAll("a")];
    const next = links[Math.min(links.length - 1, Math.max(0, focused + step))];
    next?.focus();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    next?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }

  return (
    <main className={styles.screen}>
      <header className={styles.top}>
        <h1 className={styles.wordmark}>Piano Arcade</h1>
        <p className={styles.hint}>↑ ↓ choose · Enter play</p>
      </header>
      {song && (
        <section className={styles.focus} key={song.id} aria-live="polite">
          <div className={styles.jacket}>
            <SongJacket id={song.id} title={song.title} composer={song.composer} />
          </div>
          <h2 className={styles.title}>{song.title}</h2>
          <p className={styles.composer}>
            {song.composer}
            {song.catalog && ` · ${song.catalog}`}
          </p>
          <dl className={styles.stats}>
            <div className={styles.level}>
              <dt>Level</dt>
              <dd>{song.level}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{song.noteCount}</dd>
            </div>
          </dl>
        </section>
      )}
      <ol className={styles.list} onKeyDown={onKeyDown}>
        {songs.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`/play?song=${s.id}`}
              autoFocus={i === 0}
              className={styles.link}
              data-testid={`song-${s.id}`}
              onFocus={() => setFocused(i)}
            >
              <SongCard
                {...s}
                focused={i === focused}
                jacket={<SongJacket id={s.id} title={s.title} composer={s.composer} />}
              />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
