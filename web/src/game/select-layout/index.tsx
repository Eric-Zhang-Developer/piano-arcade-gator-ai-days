"use client";
// The music select (/), in the Duo look (duo-select): the focused song in a bracketed panel on the left, the song rows
// on the right. Each row is a link, so click and Enter play (the panel's piano roll moving into the stage card,
// select-to-stage); ↑/↓ move focus and keep the focused row centered in the list; P opens adaptive practice
// (adaptive-chunks); L learns the focused song in wait mode (learn-from-select); W watches it; E switches Normal and
// Easy (easy-charts), and every href and best grade follows the level. Hrefs and L also carry the song's Hands and
// Speed (song-options).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Chart } from "../../contracts";
import { adaptUrl, songPhrases, start } from "../adaptive-chunks/next";
import { FocusPanel, SongRow } from "../duo-select/Select";
import { LevelToggle, useLevel, withLevel } from "../easy-charts";
import { useBestGrades } from "../records/best";
import { recordKey } from "../records/store";
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
  const bestOf = (id: string) => best[recordKey(id, levelParams)];
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

  // PRACTICE: adaptive practice from the whole song (adaptive-chunks), with the song's hands and level. It needs the
  // chart's phrases, so it waits for the focused chart.
  const hands = song ? options[song.id]?.hands : undefined;
  const practiceHref =
    song && chart?.id === song.id
      ? (() => {
          const q = new URLSearchParams({ song: song.id });
          if (hands && hands !== "both") q.set("hands", hands);
          const list = songPhrases(chart.chart, q.get("hands"));
          return list.length ? withLevel(adaptUrl(q, list, start(list)), level) : null;
        })()
      : null;

  function onKeyDown(e: KeyboardEvent<HTMLOListElement>) {
    if (isPracticeKey(e) && practiceHref) {
      e.preventDefault();
      return router.push(practiceHref);
    }
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

  const playHref = (id: string) => withOptions(withLevel(`/play?song=${id}`, level), options[id]);
  return (
    <main className={styles.screen}>
      <header className={styles.top}>
        <h1 className={styles.wordmark}>Piano Arcade</h1>
        <p className={styles.hint}>
          <b>↑↓</b> SELECT · <b>ENTER</b> PLAY · <b>P</b> PRACTICE
        </p>
      </header>
      <div className={styles.left}>
        {song && (
          <FocusPanel
            key={song.id}
            id={song.id}
            title={song.title}
            composer={song.composer}
            catalog={song.catalog}
            roll={song.roll}
            level={song.level}
            notes={song.noteCount}
            best={bestOf(song.id)}
            playHref={playHref(song.id)}
            practiceHref={practiceHref}
            onPlay={onPlay}
          >
            <LevelToggle normal={song.level} chart={chart?.id === song.id ? chart.chart : null} />
            <SongPreview id={song.id} />
          </FocusPanel>
        )}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      <ol className={styles.list} onKeyDown={onKeyDown}>
        {songs.map((s, i) => (
          <li key={s.id}>
            <Link
              href={playHref(s.id)}
              autoFocus={i === 0}
              className={styles.link}
              data-testid={`song-${s.id}`}
              onClick={onPlay}
              onFocus={() => setFocused(i)}
              onMouseEnter={(e) => e.currentTarget.focus({ preventScroll: true })} // hover highlights too (song-preview)
            >
              <SongRow title={s.title} composer={s.composer} level={s.level} roll={s.roll} focused={i === focused} />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}

// P on the select: plain p or P, no modifiers, no repeat (the laptop piano's KeyP plays only on /play).
const isPracticeKey = (e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat">) =>
  (e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;
