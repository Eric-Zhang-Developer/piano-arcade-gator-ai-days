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

const byLevel = (a: Song, b: Song) => a.level - b.level || a.title.localeCompare(b.title);

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
