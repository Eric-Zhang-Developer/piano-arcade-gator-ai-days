import { describe, expect, it } from "vitest";
import { filterSongs, sortSongs } from "../song-finder";
import type { Song } from "../song-select/load";
import { LEVEL_BANDS, sectionsOf } from ".";

// Test data only, never shown on a page.
const song = (id: string, level: number, composer: string, title = id): Song =>
  ({ id, title, composer, level, noteCount: 10, roll: { notes: [], lo: 60, hi: 72, beats: 4 } }) as unknown as Song;

const keys = (songs: Song[], sort: "level" | "composer" | "recent", played?: Set<string>) =>
  sectionsOf(songs, sort, played).map((s) => [s.label, s.songs.map((x) => x.id)]);

describe("sectionsOf", () => {
  const lib = [
    song("a", 1, "Trad"),
    song("b", 3, "Johann Sebastian Bach"),
    song("c", 4, "Frédéric Chopin"),
    song("d", 9, "Frédéric Chopin"),
    song("e", 15, "Ludwig van Beethoven"),
    song("f", 6, "Christian Petzold (attributed; once to Bach)"),
  ];

  it("level: one section per band, in band order, labeled by number", () => {
    expect(keys(sortSongs(lib, "level"), "level")).toEqual([
      ["LV 01–03", ["a", "b"]],
      ["LV 04–05", ["c"]],
      ["LV 06–07", ["f"]],
      ["LV 08–09", ["d"]],
      ["LV 10–15", ["e"]],
    ]);
  });

  it("composer: one section per surname, by song-finder's surname rule", () => {
    expect(keys(sortSongs(lib, "composer"), "composer")).toEqual([
      ["Bach", ["b"]],
      ["Beethoven", ["e"]],
      ["Chopin", ["c", "d"]],
      ["Petzold", ["f"]],
      ["Trad", ["a"]],
    ]);
  });

  it("recent: played first, then not played yet", () => {
    const played = new Set(["d", "a"]);
    const lastPlayed = { d: "2026-10-25T10:00:00Z", a: "2026-10-25T09:00:00Z" };
    expect(keys(sortSongs(lib, "recent", lastPlayed), "recent", played)).toEqual([
      ["Played", ["d", "a"]],
      ["Not played yet", ["b", "c", "f", "e"]],
    ]);
    expect(keys(sortSongs(lib, "recent"), "recent")).toEqual([["Not played yet", ["a", "b", "c", "f", "d", "e"]]]);
  });

  it("ties stay in song-finder's order inside a section", () => {
    const tied = [song("y", 5, "Bach", "Zed"), song("x", 5, "Bach", "Alpha"), song("w", 4, "Bach", "Mid")];
    expect(keys(sortSongs(tied, "level"), "level")).toEqual([["LV 04–05", ["w", "x", "y"]]]);
  });

  it("an empty list has no sections", () => {
    expect(sectionsOf([], "level")).toEqual([]);
    expect(sectionsOf([], "composer")).toEqual([]);
    expect(sectionsOf([], "recent")).toEqual([]);
  });

  it("a search that empties a section hides it; the others keep their headers", () => {
    const shown = filterSongs(sortSongs(lib, "composer"), "chopin");
    expect(keys(shown, "composer")).toEqual([["Chopin", ["c", "d"]]]);
    expect(keys(filterSongs(sortSongs(lib, "level"), "chopin"), "level")).toEqual([
      ["LV 04–05", ["c"]],
      ["LV 08–09", ["d"]],
    ]);
  });

  it("a 40-song library: every song in exactly one section, none empty, none holding most of it", () => {
    const names = ["Bach", "Beethoven", "Chopin", "Debussy", "Mozart", "Satie", "Schumann", "Grieg"];
    const forty = Array.from({ length: 40 }, (_, i) => song(`s${i}`, 1 + ((i * 7) % 15), `Someone ${names[i % names.length]}`));
    for (const sort of ["level", "composer", "recent"] as const) {
      const sections = sectionsOf(sortSongs(forty, sort), sort);
      expect(sections.flatMap((s) => s.songs.map((x) => x.id)).sort()).toEqual(forty.map((s) => s.id).sort());
      expect(sections.every((s) => s.songs.length > 0)).toBe(true);
      expect(new Set(sections.map((s) => s.key)).size).toBe(sections.length);
    }
    const byLevel = sectionsOf(sortSongs(forty, "level"), "level");
    expect(byLevel).toHaveLength(LEVEL_BANDS.length);
    expect(Math.max(...byLevel.map((s) => s.songs.length))).toBeLessThanOrEqual(20);
  });

  it("the bands cover 1 to 15 without a gap or an overlap", () => {
    const covered = LEVEL_BANDS.flatMap(([lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
    expect(covered).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });
});
