import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { labEntries } from "./entries";

const repo = new URL("../../../../", import.meta.url);
const web = new URL("../../../", import.meta.url);
// Whitespace collapsed, Markdown emphasis and backticks dropped, on both sides.
const plain = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();
const note = (slug: string) => new URL(`changes/${slug}.md`, repo);

describe("lab entries (lab)", () => {
  it.each(labEntries)("$slug has a done note, and its description is copied from it", ({ slug, description }) => {
    expect(existsSync(note(slug)), `changes/${slug}.md`).toBe(true);
    expect(plain(readFileSync(note(slug), "utf8"))).toContain(plain(description));
  });

  it.each(labEntries)("$slug opens a page under web/src/app/, with a song from the library", ({ href }) => {
    const url = new URL(href, "http://lab");
    expect(existsSync(new URL(`src/app${url.pathname}/page.tsx`, web)), `${url.pathname} page`).toBe(true);
    const song = url.searchParams.get("song");
    if (song) expect(existsSync(new URL(`public/songs/${song}/chart.json`, web)), `song ${song}`).toBe(true);
  });

  it("has no feature twice and keeps descriptions short", () => {
    const slugs = labEntries.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const e of labEntries) expect(e.description.split(/\s+/).length, e.slug).toBeLessThanOrEqual(24);
  });

  // Holds the test to something: a description that isn't in its note fails.
  it("rejects a description written fresh", () => {
    expect(plain(readFileSync(note("rewind"), "utf8"))).not.toContain(plain("Rewind lets you go back a bar."));
  });
});
