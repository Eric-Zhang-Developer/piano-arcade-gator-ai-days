// Song finder (spec: song-finder): the select's list sorted by level, composer or recently played, and filtered by
// what's typed. Pure, plus the two localStorage keys it reads and writes; the select wires it in.
import { browserStorage } from "../records/store";
import type { Song } from "../song-select/load";

export type SortMode = "level" | "composer" | "recent";
export const SORT_MODES: SortMode[] = ["level", "composer", "recent"];
export const LAST_PLAYED_KEY = "pianoArcade.lastPlayed"; // song id -> ISO time of its last finished take
export const SORT_KEY = "pianoArcade.songSort";

type LastPlayed = Record<string, string>;
type Store = Pick<Storage, "getItem" | "setItem"> | null;

// Twinkle stays the front door (the first row takes focus); other ties sort by title (song-pack-9 tied it at level 1).
const byLevel = (a: Song, b: Song) => a.level - b.level || +(b.id === "twinkle") - +(a.id === "twinkle") || a.title.localeCompare(b.title);

// The last word before any parenthesis: "Ludwig van Beethoven" is Beethoven, "Christian Petzold (attributed; …)" Petzold.
export function surname(composer: string): string {
  const words = composer.split("(")[0].trim().split(/\s+/);
  return words[words.length - 1];
}

export function sortSongs(songs: Song[], mode: SortMode, lastPlayed: LastPlayed = {}): Song[] {
  const out = [...songs];
  if (mode === "composer") return out.sort((a, b) => surname(a.composer).localeCompare(surname(b.composer)) || byLevel(a, b));
  if (mode === "recent") {
    const at = (s: Song) => Date.parse(lastPlayed[s.id] ?? "") || 0; // never played (or unreadable): 0, after every played song
    return out.sort((a, b) => at(b) - at(a) || byLevel(a, b));
  }
  return out.sort(byLevel);
}

// Case and accents don't matter: "fur elise" finds "Für Elise".
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// The songs whose title, composer or catalog contains every typed word; an empty query keeps them all.
export function filterSongs(songs: Song[], query: string): Song[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return songs;
  return songs.filter((s) => {
    const text = fold(`${s.title} ${s.composer} ${s.catalog ?? ""}`);
    return words.every((w) => text.includes(w));
  });
}

// Unreadable, broken or blocked storage reads as nothing played, so Recent falls back to Level order.
export function readLastPlayed(storage: Store = browserStorage()): LastPlayed {
  try {
    const v: unknown = JSON.parse(storage?.getItem(LAST_PLAYED_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as LastPlayed) : {};
  } catch {
    return {};
  }
}

export function markPlayed(id: string, at: Date = new Date(), storage: Store = browserStorage()): void {
  try {
    storage?.setItem(LAST_PLAYED_KEY, JSON.stringify({ ...readLastPlayed(storage), [id]: at.toISOString() }));
  } catch {
    // blocked or full: Recent just won't know this take
  }
}

export function readSort(storage: Store = browserStorage()): SortMode {
  try {
    const v = storage?.getItem(SORT_KEY);
    return SORT_MODES.includes(v as SortMode) ? (v as SortMode) : "level";
  } catch {
    return "level";
  }
}

export function writeSort(mode: SortMode, storage: Store = browserStorage()): void {
  try {
    storage?.setItem(SORT_KEY, mode);
  } catch {
    // the choice just won't survive a reload
  }
}

// Whether a new order or filter moves focus to the panel's row: focus is in the column's list, or nowhere (<body>,
// after a re-sort remounted the focused row). A sort chip or the search box keeps it.
export const takesFocus = (active: Element | null, body: Element, column: Element | null) =>
  !active || active === body || (!!active.closest("ol") && !!column?.contains(active));

// What the finder's live region says (#1035): nothing until the player types or sorts, then the count shown, or the
// no-match line.
export function announcement(touched: boolean, query: string, shown: number, total: number): string {
  const q = query.trim();
  if (!touched) return "";
  if (!q) return `${total} songs`;
  return shown ? `${shown} of ${total} songs` : `No song matches ${q}`;
}
