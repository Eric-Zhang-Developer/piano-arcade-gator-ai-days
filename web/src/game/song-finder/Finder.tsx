"use client";
// The finder row over the select's list (spec: song-finder): a search box, the count shown, and the three sorts as
// kit chips. useFinder holds the state; the select renders the songs it returns.
import { useMemo, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { kitChip } from "../duo-tokens";
import type { Song } from "../song-select/load";
import { filterSongs, readLastPlayed, readSort, SORT_MODES, sortSongs, writeSort, type SortMode } from ".";
import css from "./finder.module.css";

const LABELS: Record<SortMode, string> = {
  level: "Level",
  composer: "Composer",
  recent: "Recent",
};

// The sort choice as an external store, as easy-charts keeps the level: the server renders Level, the client then
// renders the stored choice without a mismatch.
let sortNow: SortMode | null = null; // null until first read
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
const getSort = () => (sortNow ??= readSort());

export function useFinder(songs: Song[]) {
  const sort = useSyncExternalStore(subscribe, getSort, () => "level" as SortMode);
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false); // once the player sorts or types; until then the list is today's
  // Read on each visit to the select, so a take just finished on /play is already in it. The server reads nothing,
  // and its Level order doesn't use this.
  const lastPlayed = useMemo(() => readLastPlayed(), []);
  const shown = useMemo(() => filterSongs(sortSongs(songs, sort, lastPlayed), query), [songs, sort, lastPlayed, query]);
  const setSort = (mode: SortMode) => {
    sortNow = mode;
    writeSort(mode);
    listeners.forEach((l) => l());
    setTouched(true);
  };
  const type = (q: string) => {
    setQuery(q);
    setTouched(true);
  };
  return {
    shown,
    total: songs.length,
    sort,
    setSort,
    query,
    setQuery: type,
    touched,
  };
}

// ↓ from the search box goes to the first song shown, so the list is reachable without the mouse.
function toList(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "ArrowDown") return;
  const first = e.currentTarget.closest(`.${css.column}`)?.querySelector<HTMLAnchorElement>("ol a");
  if (!first) return;
  e.preventDefault();
  first.focus();
}

// The select's list column: the finder row, then the list (children), which fills the rest and scrolls in it.
export function Finder({ finder, children }: { finder: ReturnType<typeof useFinder>; children: ReactNode }) {
  const { shown, total, sort, setSort, query, setQuery } = finder;
  return (
    <div className={css.column}>
      <div className={css.finder}>
        <div className={css.bar}>
          <label className={css.search}>
            <span className={css.label}>Find</span>
            <input
              type="search"
              className={css.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="title, composer, catalog"
              aria-label="Find a song"
              spellCheck={false}
              autoComplete="off"
              data-testid="finder-search"
              onKeyDown={toList}
            />
          </label>
          <span className={css.count} data-testid="finder-count">
            {shown.length === total ? `${total} songs` : `${shown.length} of ${total}`}
          </span>
          <div className={css.sorts} role="group" aria-label="Sort songs">
            {SORT_MODES.map((m) => {
              const chip = kitChip(m === sort);
              return (
                <button
                  key={m}
                  type="button"
                  className={chip.className}
                  style={chip.style}
                  aria-pressed={m === sort}
                  data-testid={`finder-sort-${m}`}
                  onClick={() => setSort(m)}
                >
                  {LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>
        {!shown.length && (
          <p className={css.none} data-testid="finder-none">
            <span>No song matches “{query.trim()}”</span>
            <button type="button" {...kitChip(false)} onClick={() => setQuery("")} data-testid="finder-clear">
              Clear
            </button>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
