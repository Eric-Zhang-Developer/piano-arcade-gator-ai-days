import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadSongs, type Song } from "../song-select/load";
import { announcement, filterSongs, LAST_PLAYED_KEY, markPlayed, readLastPlayed, readSort, sortSongs, surname, writeSort } from ".";

const song = (id: string, title: string, composer: string, level: number, catalog?: string): Song => ({ id, title, composer, level, catalog, noteCount: 1, roll: [] as unknown as Song["roll"] });
const ids = (songs: Song[]) => songs.map((s) => s.id);

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const blocked = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
};

const a = song("a", "Ode to Joy", "Ludwig van Beethoven", 2);
const b = song("b", "Prélude in E minor", "Frédéric Chopin", 5, "Op. 28 No. 4");
const c = song("c", "Für Elise", "Ludwig van Beethoven", 5, "WoO 59");
const d = song("d", "Minuet in G", "Christian Petzold (attributed; formerly J. S. Bach)", 3);
const e = song("e", "Gymnopédie No. 1", "Erik Satie", 3);
const all = [c, b, e, a, d];

describe("sortSongs", () => {
  it("Level: level, then title, so ties keep a stable order", () => {
    expect(ids(sortSongs(all, "level"))).toEqual(["a", "e", "d", "c", "b"]); // Gymnopédie before Minuet at 3; Für before Prélude at 5
  });

  it("Composer: by surname, then level", () => {
    expect(ids(sortSongs(all, "composer"))).toEqual(["a", "c", "b", "d", "e"]); // Beethoven 2, Beethoven 5, Chopin, Petzold, Satie
  });

  it("Recent: most recent first, then the never-played in Level order", () => {
    const last = { b: "2026-10-25T09:00:00Z", d: "2026-10-25T10:00:00Z", e: "not a date" };
    expect(ids(sortSongs(all, "recent", last))).toEqual(["d", "b", "a", "e", "c"]);
    expect(ids(sortSongs(all, "recent", {}))).toEqual(ids(sortSongs(all, "level")));
  });

  it("never changes the list it was given", () => {
    const before = ids(all);
    sortSongs(all, "composer");
    expect(ids(all)).toEqual(before);
  });
});

describe("surname", () => {
  it("is the last word before any parenthesis", () => {
    expect(surname("Ludwig van Beethoven")).toBe("Beethoven");
    expect(surname("Christian Petzold (attributed; formerly J. S. Bach)")).toBe("Petzold");
    expect(surname("Traditional (French melody \"Ah! vous dirai-je, maman\")")).toBe("Traditional");
  });

  it("gives every composer in the library a one-word surname", () => {
    const { songs } = loadSongs(fileURLToPath(new URL("../../../public/songs", import.meta.url)));
    expect(songs.length).toBeGreaterThan(0);
    for (const s of songs) expect(surname(s.composer)).toMatch(/^[^\s()]+$/u);
  });
});

describe("filterSongs", () => {
  it("ignores case and accents", () => {
    expect(ids(filterSongs(all, "fur elise"))).toEqual(["c"]);
    expect(ids(filterSongs(all, "GYMNOPEDIE"))).toEqual(["e"]);
  });

  it("needs every word, from title, composer or catalog", () => {
    expect(ids(filterSongs(all, "beethoven"))).toEqual(["c", "a"]);
    expect(ids(filterSongs(all, "beethoven woo"))).toEqual(["c"]);
    expect(ids(filterSongs(all, "op. 28"))).toEqual(["b"]);
    expect(filterSongs(all, "zzz")).toEqual([]);
  });

  it("an empty or blank query keeps every song", () => {
    expect(filterSongs(all, "")).toBe(all);
    expect(filterSongs(all, "   ")).toBe(all);
  });
});

describe("lastPlayed", () => {
  it("writes one ISO time per song id and reads it back", () => {
    const s = memory();
    markPlayed("a", new Date("2026-10-25T09:00:00Z"), s);
    markPlayed("b", new Date("2026-10-25T10:00:00Z"), s);
    markPlayed("a", new Date("2026-10-25T11:00:00Z"), s);
    expect(readLastPlayed(s)).toEqual({ a: "2026-10-25T11:00:00.000Z", b: "2026-10-25T10:00:00.000Z" });
  });

  it("empty, broken or blocked storage reads as nothing played, never an error", () => {
    expect(readLastPlayed(memory())).toEqual({});
    const broken = memory();
    broken.m.set(LAST_PLAYED_KEY, "{not json");
    expect(readLastPlayed(broken)).toEqual({});
    broken.m.set(LAST_PLAYED_KEY, "[1,2]");
    expect(readLastPlayed(broken)).toEqual({});
    expect(readLastPlayed(blocked)).toEqual({});
    expect(readLastPlayed(null)).toEqual({});
    expect(() => markPlayed("a", new Date(), blocked)).not.toThrow();
  });
});

describe("the sort choice", () => {
  it("persists, and anything else reads as Level", () => {
    const s = memory();
    expect(readSort(s)).toBe("level");
    writeSort("recent", s);
    expect(readSort(s)).toBe("recent");
    s.m.set("pianoArcade.songSort", "shuffle");
    expect(readSort(s)).toBe("level");
    expect(readSort(blocked)).toBe("level");
    expect(() => writeSort("composer", blocked)).not.toThrow();
  });
});

describe("the live region's line", () => {
  it("says nothing before the player types or sorts, then the count, or the no-match line", () => {
    expect(announcement(false, "", 31, 31)).toBe("");
    expect(announcement(true, "chopin", 3, 31)).toBe("3 of 31 songs");
    expect(announcement(true, "  zzqx ", 0, 31)).toBe("No song matches zzqx");
    expect(announcement(true, "", 31, 31)).toBe("31 songs");
  });
});
