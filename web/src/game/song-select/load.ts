// Finds every chart.json under a songs folder, at any depth. Node only: the song list page calls it at build time.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { validateChart, type Chart } from "../../contracts";
import { difficulty } from "../difficulty/difficulty";
import { roll, type Roll } from "../duo-select/roll";
import { keyOf, type Key } from "../ui-sounds/timbre";

// Chart folders only an experiment opens, such as the round's (#1123): kept off the select and out of the library's
// own checks (difficulty order, jackets, sheets), since they aren't library songs. songs/library.test.ts still
// validates them.
export const LAB_ONLY = ["rounds"];

export interface Song {
  id: string; // the chart's folder under songs/, what /play?song= takes
  title: string;
  composer: string;
  catalog?: string;
  noteCount: number;
  level: number; // 1–15, computed from the chart (difficulty)
  roll: Roll; // the opening as piano-roll bars for the select's thumbnails (duo-select), so no row fetches its chart
  key?: Key; // inferred from all its notes (ui-sound-family), so the menu sounds play in the song's key
}

export function loadSongs(songsDir: string): { songs: Song[]; invalid: { path: string; problems: string[] }[] } {
  const songs: Song[] = [];
  const invalid: { path: string; problems: string[] }[] = [];
  const files = readdirSync(songsDir, { recursive: true, encoding: "utf8" }).filter((f) => f.split(sep).pop() === "chart.json" && !LAB_ONLY.includes(f.split(sep)[0]));
  for (const path of files) {
    let chart: Chart;
    try {
      chart = JSON.parse(readFileSync(join(songsDir, path), "utf8"));
    } catch (e) {
      invalid.push({ path, problems: [`not JSON: ${(e as Error).message}`] });
      continue;
    }
    const problems = validateChart(chart);
    if (problems.length) {
      invalid.push({ path, problems });
      continue;
    }
    const id = dirname(path).split(sep).join("/");
    songs.push({ id, title: chart.title, composer: chart.composer, catalog: chart.catalog, noteCount: chart.notes.length, level: difficulty(chart).level, roll: roll(chart), key: keyOf(chart.notes.map((n) => n.pitch)) });
  }
  songs.sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)); // easiest first
  return { songs, invalid };
}
