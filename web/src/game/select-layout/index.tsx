"use client";
// The music select (/): the focused song large on the left, the song cards on the right. Each card is a link, so
// click and Enter play (the focused jacket moving into the stage card, select-to-stage); ↑/↓ move focus and keep the
// focused card centered in the list; L learns the focused song in wait mode (learn-from-select); E switches Normal and
// Easy (easy-charts), and every href and best grade follows the level. Hrefs and L also carry the song's Hands and
// Speed (song-options).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Chart } from "../../contracts";
import { LevelToggle, useLevel, withLevel } from "../easy-charts";
import { useBestGrades } from "../records/best";
import { recordKey } from "../records/store";
import { SongCard } from "../song-card";
import { SongJacket } from "../song-jacket/SongJacket";
import { SelectStage } from "../select-stage";
import { isLearnKey, learnUrl, SongPreview } from "../song-preview";
import { useSongOptions, withOptions } from "../song-options";
import { isWatchKey, watchUrl } from "../watch-demo/demo";
import { uiSound } from "../ui-sounds";
import type { Song } from "../song-select/load";
import { goToStage } from "./go-to-stage";
import styles from "./select-layout.module.css";

// footer: the left column's last row, in flow under the focused song (the Options button, first-run's link). Outside the
// per-song section, so it isn't remounted on every ↑/↓.
export function MusicSelect({ songs, footer }: { songs: Song[]; footer?: ReactNode }) {
  const [focused, setFocused] = useState(0);
  const best = useBestGrades();
  const options = useSongOptions();
  const router = useRouter();
  const song = songs[focused];
  const [level, setLevel] = useLevel();
  const levelParams = new URLSearchParams(level === "easy" ? "level=easy" : "");
  const bestOf = (id: string) => best[recordKey(id, levelParams, 3)];
  const [chart, setChart] = useState<{ id: string; chart: Chart } | null>(null); // the focused song's, for its Easy level

  useEffect(() => {
    if (!song) return;
    let live = true;
    fetch(`/songs/${song.id}/chart.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Chart | null) => live && c && setChart({ id: song.id, chart: c }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [song]);

  // E anywhere on the select (not while typing), no modifiers, no repeat.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== "e" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]")) return;
      setLevel(level === "easy" ? "normal" : "easy");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level, setLevel]);

  function onKeyDown(e: KeyboardEvent<HTMLOListElement>) {
    if (isLearnKey(e) && song) {
      e.preventDefault();
      return router.push(withOptions(withLevel(learnUrl(song.id), level), options[song.id]));
    }
    if (isWatchKey(e) && song) {
      e.preventDefault();
      return router.push(watchUrl(song.id)); // watch-demo: the Normal chart, whatever the level (its spec's default)
    }
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const links = [...e.currentTarget.querySelectorAll("a")];
    const next = links[focused + step];
    if (!next) return; // at the list's ends: no move, no sound
    uiSound("move");
    next.focus();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    next.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }

  // A plain click or Enter (a click with detail 0) moves into the stage; modifier and middle clicks stay links.
  function onPlay(e: MouseEvent<HTMLAnchorElement>) {
    uiSound("confirm"); // Enter on a link clicks it too
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
          <b>↑ ↓</b> choose · <b>Enter</b> play · <b>L</b> learn · <b>W</b> watch · <b>E</b> easy
        </p>
      </header>
      <div className={styles.left}>
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
            <div className={styles.statsRow}>
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
              <LevelToggle normal={song.level} chart={chart?.id === song.id ? chart.chart : null} />
            </div>
            <SongPreview id={song.id} best={bestOf(song.id)} />
          </section>
        )}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      <ol className={styles.list} onKeyDown={onKeyDown}>
        {songs.map((s, i) => (
          <li key={s.id}>
            <Link
              href={withOptions(withLevel(`/play?song=${s.id}`, level), options[s.id])}
              autoFocus={i === 0}
              className={styles.link}
              data-testid={`song-${s.id}`}
              aria-current={i === focused ? "true" : undefined}
              onClick={onPlay}
              onFocus={() => setFocused(i)}
              onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })} // hover highlights too (song-preview)
            >
              <SongCard
                {...s}
                focused={i === focused}
                jacket={<SongJacket id={s.id} title={s.title} composer={s.composer} />}
                best={bestOf(s.id)}
              />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
