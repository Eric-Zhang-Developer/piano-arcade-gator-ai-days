"use client";
// The music select (/): the focused song large on the left, the song cards on the right. Each card is a link, so
// click and Enter play (the focused jacket moving into the stage card, select-to-stage); ↑/↓ move focus and keep the
// focused card centered in the list; L learns the focused song in wait mode (learn-from-select).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { useBestGrades } from "../records/best";
import { SongCard } from "../song-card";
import { SongJacket } from "../song-jacket/SongJacket";
import { SelectStage } from "../select-stage";
import { isLearnKey, learnUrl, SongPreview } from "../song-preview";
import type { Song } from "../song-select/load";
import { goToStage } from "./go-to-stage";
import styles from "./select-layout.module.css";

export function MusicSelect({ songs }: { songs: Song[] }) {
  const [focused, setFocused] = useState(0);
  const best = useBestGrades();
  const router = useRouter();
  const song = songs[focused];

  function onKeyDown(e: KeyboardEvent<HTMLOListElement>) {
    if (isLearnKey(e) && song) {
      e.preventDefault();
      return router.push(learnUrl(song.id));
    }
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const links = [...e.currentTarget.querySelectorAll("a")];
    const next = links[Math.min(links.length - 1, Math.max(0, focused + step))];
    next?.focus();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    next?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }

  // A plain click or Enter (a click with detail 0) moves into the stage; modifier and middle clicks stay links.
  function onPlay(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goToStage(e.currentTarget.getAttribute("href")!, router);
  }

  return (
    <main className={styles.screen}>
      <SelectStage />
      <header className={styles.top}>
        <h1 className={styles.wordmark}>Piano Arcade</h1>
        <p className={styles.hint}>
          <b>↑ ↓</b> choose · <b>Enter</b> play · <b>L</b> learn
        </p>
      </header>
      {song && (
        <section className={styles.focus} key={song.id} aria-live="polite">
          <div className={styles.jacket} style={{ viewTransitionName: "stage-jacket" }}>
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
          <SongPreview id={song.id} best={best[song.id]} />
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
              onClick={onPlay}
              onFocus={() => setFocused(i)}
              onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })} // hover highlights too (song-preview)
            >
              <SongCard
                {...s}
                focused={i === focused}
                jacket={<SongJacket id={s.id} title={s.title} composer={s.composer} />}
                best={best[s.id]}
              />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
