import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";
import { expect, test } from "vitest";
import { jacketColors, jacketFor } from ".";
import { LAB_ONLY } from "../song-select/load";

const root = new URL("../../../public/songs", import.meta.url).pathname;
const songs = readdirSync(root, { recursive: true, encoding: "utf8" })
  .filter((f) => f.split(sep).pop() === "chart.json" && !LAB_ONLY.includes(f.split(sep)[0]))
  .map((f) => JSON.parse(readFileSync(`${root}/${f}`, "utf8")) as { id: string; title: string; composer: string });

test("the library has songs to check", () => {
  expect(songs.length).toBeGreaterThan(5);
});

test("the same id gives the same jacket", () => {
  for (const s of songs) expect(jacketFor(s.id, s.title, s.composer)).toEqual(jacketFor(s.id, s.title, s.composer));
});

test("every gradient color is a cabinet color", () => {
  for (const s of songs) for (const c of jacketFor(s.id, s.title, s.composer).stops) expect(jacketColors).toContain(c);
});

test("no two library songs share both the angle and the first color", () => {
  const seen = new Map<string, string>();
  for (const s of songs) {
    const j = jacketFor(s.id, s.title, s.composer);
    const key = `${j.angle} ${j.stops[0]}`;
    expect(seen.get(key), `${s.id} looks like ${seen.get(key)}`).toBeUndefined();
    seen.set(key, s.id);
  }
});

test("the word is the title's first word, or the composer's surname after an article", () => {
  expect(jacketFor("x", "Twinkle, Twinkle, Little Star", "Traditional").word).toBe("Twinkle");
  expect(jacketFor("x", "The Entertainer", "Scott Joplin").word).toBe("Joplin");
  expect(jacketFor("x", "Für Elise", "Ludwig van Beethoven").word).toBe("Für");
});
