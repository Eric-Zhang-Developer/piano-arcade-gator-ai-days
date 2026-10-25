// Main page (spec: main-page): the select's list in sections that follow song-finder's sort. Pure: it takes the list as
// song-finder sorted and filtered it, and cuts it where the section changes, so the order is song-finder's, untouched.
import { surname, type SortMode } from "../song-finder";
import type { Song } from "../song-select/load";

export interface Section {
  key: string; // stable across a search, for React keys and the chip's target
  label: string;
  songs: Song[];
}

// Fixed bands, so a chip keeps its meaning as songs are added. Chosen on the 40 songs of 2026-10-25 (4, 9, 11, 8 and 8
// songs) so none is empty or holds most of the library; specs/decisions/main-page-bands.md.
export const LEVEL_BANDS: [number, number][] = [
  [1, 3],
  [4, 5],
  [6, 7],
  [8, 9],
  [10, 15],
];

const lv = (n: number) => String(n).padStart(2, "0");

function band(level: number): { key: string; label: string } {
  const [lo, hi] = LEVEL_BANDS.find(([, hi]) => level <= hi) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];
  return { key: `lv-${lo}`, label: lo === hi ? `LV ${lv(lo)}` : `LV ${lv(lo)}–${lv(hi)}` };
}

// played: the ids with a finished take (song-finder's last-played store), for Recent.
export function sectionsOf(songs: Song[], sort: SortMode, played: ReadonlySet<string> = new Set()): Section[] {
  const of = (s: Song) => {
    if (sort === "level") return band(s.level);
    if (sort === "composer") return { key: `by-${surname(s.composer).toLowerCase()}`, label: surname(s.composer) };
    return played.has(s.id) ? { key: "played", label: "Played" } : { key: "unplayed", label: "Not played yet" };
  };
  const out: Section[] = [];
  for (const s of songs) {
    const { key, label } = of(s);
    const last = out[out.length - 1];
    if (last?.key === key) last.songs.push(s);
    else out.push({ key, label, songs: [s] });
  }
  return out;
}
