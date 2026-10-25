"use client";
// The music select (/), in the Duo look (duo-select): the focused song in a bracketed panel on the left, the song rows
// on the right. Each row is a link, so click and Enter play (the panel's piano roll moving into the stage card,
// select-to-stage); ↑/↓ move focus and keep the focused row centered in the list; P opens adaptive practice
// (adaptive-chunks) in Flow (play-modes); L learns the focused song in Learn (learn-from-select); W watches it; E
// switches Normal and Easy (easy-charts), and every href and best grade follows the level. Hrefs and L also carry the
// song's Hands and Speed (song-options).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
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
import { APP_NAME } from "../app-name";
import { HelpLink } from "../help-overlay";
import { Finder, useFinder } from "../song-finder/Finder";
import { readLastPlayed } from "../song-finder";
import { sectionsOf } from "../main-page";
import { SectionChips, SectionHeader, sectionId } from "../main-page/Sections";

// footer: the left column's last row, in flow under the focused song (the Options button, first-run's link). Outside the
// per-song section, so it isn't remounted on every ↑/↓.
export function MusicSelect({ songs, footer }: { songs: Song[]; footer?: ReactNode }) {
  const [focusedId, setFocusedId] = useState<string>(); // song-finder: the focused song, by id, so it survives a sort
  const best = useBestGrades();
  const options = useSongOptions();
  const router = useRouter();
  const finder = useFinder(songs); // song-finder: the list as sorted and filtered
  const shown = finder.shown;
  // Sorting or filtering keeps the focused song if it's still shown, else the first shown song takes focus. With no
  // match the panel keeps the last one, rather than leaving half the screen empty.
  const focused = Math.max(0, shown.findIndex((s) => s.id === focusedId));
  const song = shown[focused] ?? songs.find((s) => s.id === focusedId) ?? songs[0];
  // main-page: the shown list cut into sections by the sort; Recent's "Played" is the ids with a finished take.
  const played = useMemo(() => new Set(Object.keys(readLastPlayed())), []);
  const sections = useMemo(() => sectionsOf(shown, finder.sort, played), [shown, finder.sort, played]);
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

  // PRACTICE: adaptive practice from the whole song (adaptive-chunks), in Flow (play-modes: practice opens Flow), with
  // the song's hands and level. It needs the chart's phrases, so it waits for the focused chart.
  const hands = song ? options[song.id]?.hands : undefined;
  const practiceHref =
    song && chart?.id === song.id
      ? (() => {
          const q = new URLSearchParams({ song: song.id, mode: "flow" });
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
      return router.push(learnHref(song.id));
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
    uiSound("move", 0, { key: shown[focused + step]?.key });
    next.focus();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    next.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }

  // A plain click or Enter (a click with detail 0) moves into the stage; modifier and middle clicks stay links.
  function onPlay(e: MouseEvent<HTMLAnchorElement>) {
    uiSound("confirm", 0, { key: song?.key }); // Enter on a link clicks it too
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    goToStage(e.currentTarget.getAttribute("href")!, router);
  }

  // A chip: the list scrolls to the section's header and its first song takes focus (reduced motion: a jump).
  function jump(key: string) {
    const header = document.getElementById(sectionId(key));
    const first = header?.parentElement?.querySelector("a");
    if (!header || !first) return;
    uiSound("move", 0, { key: song?.key });
    first.focus({ preventScroll: true });
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    header.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  }

  const playHref = (id: string) => withOptions(withLevel(`/play?song=${id}`, level), options[id]);
  const learnHref = (id: string) => withOptions(withLevel(learnUrl(id), level), options[id]);
  return (
    <main className={styles.screen}>
      <header className={styles.top}>
        <h1 className={styles.wordmark}>{APP_NAME}</h1>
        <HelpLink />
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
            onPlay={() => {
              uiSound("confirm", 0, { key: song.key });
              goToStage(playHref(song.id), router);
            }}
            onPractice={practiceHref ? () => router.push(practiceHref) : null}
            onLearn={() => router.push(learnHref(song.id))}
            onWatch={() => router.push(watchUrl(song.id))}
          >
            <LevelToggle normal={song.level} chart={chart?.id === song.id ? chart.chart : null} />
            <SongPreview id={song.id} />
          </FocusPanel>
        )}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      <Finder finder={finder}>
        <SectionChips
          sections={sections}
          current={sections.find((x) => x.songs.includes(shown[focused]))?.key}
          place={shown.length ? focused + 1 : 0}
          count={shown.length}
          onJump={jump}
        />
        {/* Nested lists, one per section: the outer one owns ↑/↓, which walk every link in order, headers or not. */}
        <ol className={styles.list} onKeyDown={onKeyDown} aria-label="Songs">
          {sections.map((sec) => (
            <li key={sec.key} className={styles.section} aria-labelledby={sectionId(sec.key)}>
              <SectionHeader section={sec} />
              <ol className={styles.songs}>
                {sec.songs.map((s) => {
                  const i = shown.indexOf(s);
                  return (
                    <li key={s.id}>
                      <Link
                        href={playHref(s.id)}
                        autoFocus={i === 0 && !finder.touched}
                        className={styles.link}
                        data-testid={`song-${s.id}`}
                        onClick={onPlay}
                        onFocus={() => setFocusedId(s.id)}
                        onMouseEnter={(e) => document.activeElement?.matches("input") || e.currentTarget.focus({ preventScroll: true })} // hover highlights too (song-preview), but never takes focus from the finder's box, where a typed P would start practice
                      >
                        <SongRow title={s.title} composer={s.composer} level={s.level} roll={s.roll} focused={i === focused} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </Finder>
    </main>
  );
}

// P on the select: plain p or P, no modifiers, no repeat (the laptop piano's KeyP plays only on /play).
const isPracticeKey = (e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat">) =>
  (e.key === "p" || e.key === "P") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;
