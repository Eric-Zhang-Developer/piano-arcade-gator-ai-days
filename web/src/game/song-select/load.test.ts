import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { validateChart } from "../../contracts";
import { loadSongs } from "./load";

const songs = new URL("../../../public/songs", import.meta.url).pathname;

test("the real library has Twinkle, with its note count", () => {
  const { songs: found, invalid } = loadSongs(songs);
  expect(invalid).toEqual([]);
  expect(found).toContainEqual(expect.objectContaining({ id: "twinkle", title: "Twinkle, Twinkle, Little Star", noteCount: 42 }));
});

test("finds charts at any depth, sorted by level then title (Twinkle first in its level), and skips and reports invalid ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "songs-"));
  cpSync(join(songs, "twinkle"), join(dir, "twinkle"), { recursive: true });
  mkdirSync(join(dir, "library", "bach"), { recursive: true });
  writeFileSync(
    join(dir, "library", "bach", "chart.json"),
    JSON.stringify({ id: "a", title: "A Minuet", composer: "Bach", source: "x", bpm: 90, beatsPerBar: 3, notes: [{ id: "n1", pitch: 67, beat: 0, duration: 1, hand: "R" }] }),
  );
  mkdirSync(join(dir, "broken"));
  writeFileSync(join(dir, "broken", "chart.json"), JSON.stringify({ id: "b", title: "Broken" }));
  mkdirSync(join(dir, "garbled"));
  writeFileSync(join(dir, "garbled", "chart.json"), "{");

  const { songs: found, invalid } = loadSongs(dir);
  expect(found.map((s) => s.id)).toEqual(["twinkle", "library/bach"]);
  expect(found[1]).toEqual({ id: "library/bach", title: "A Minuet", composer: "Bach", catalog: undefined, noteCount: 1, level: 1, roll: expect.objectContaining({ rows: 1 }), key: expect.objectContaining({ tonic: expect.any(Number) }) });
  expect(found[0].key).toEqual({ tonic: 0, mode: "major" }); // Twinkle, in C
  expect(found[1].roll.bars).toHaveLength(1);
  expect(invalid.map((i) => i.path).sort()).toEqual([join("broken", "chart.json"), join("garbled", "chart.json")]);
  expect(invalid.every((i) => i.problems.length > 0)).toBe(true);
});

test("the real library is sorted easiest first, Twinkle at the top", () => {
  const { songs: found } = loadSongs(songs);
  expect(found[0].id).toBe("twinkle");
  for (let i = 1; i < found.length; i++) {
    const [a, b] = [found[i - 1], found[i]];
    expect(a.level < b.level || (a.level === b.level && (a.id === "twinkle" || a.title.localeCompare(b.title) <= 0)), `${a.id} before ${b.id}`).toBe(true);
  }
});

test("experiment-only charts under songs/x/ and songs/rounds/ stay off the select, and stay where /play fetches them (#1165)", () => {
  const dir = mkdtempSync(join(tmpdir(), "songs-"));
  cpSync(join(songs, "twinkle"), join(dir, "twinkle"), { recursive: true });
  cpSync(join(songs, "twinkle"), join(dir, "x", "demo"), { recursive: true });
  cpSync(join(songs, "twinkle"), join(dir, "rounds", "demo"), { recursive: true });
  expect(loadSongs(dir).songs.map((s) => s.id)).toEqual(["twinkle"]);
  // /play?song=x/demo fetches /songs/x/demo/chart.json: the chart is still there and still valid.
  expect(validateChart(JSON.parse(readFileSync(join(dir, "x", "demo", "chart.json"), "utf8")))).toEqual([]);
});
