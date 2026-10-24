import { existsSync, readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SongSource, sourceLink } from ".";

const songsDir = new URL("../../../public/songs/", import.meta.url);
const sources = Object.fromEntries(
  readdirSync(songsDir)
    .filter((id) => existsSync(new URL(`${id}/chart.json`, songsDir))) // songs/local/ holds no chart
    .map((id) => [id, JSON.parse(readFileSync(new URL(`${id}/chart.json`, songsDir), "utf8")).source as string]),
);

describe("sourceLink", () => {
  it("links every chart to its first non-license URL", () => {
    for (const [id, source] of Object.entries(sources)) {
      const first = [...source.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0]).find((u) => !u.includes("creativecommons.org"));
      expect(sourceLink(source).href, id).toBe(first);
      expect(first, id).toBeTruthy();
    }
  });

  it("Moonlight and the Nocturne link Mutopia, not their Creative Commons license", () => {
    for (const id of ["moonlight-3", "nocturne-op9-2"]) {
      expect(sourceLink(sources[id])).toEqual({ text: "Source: Mutopia ↗", href: expect.stringContaining("mutopiaproject.org") });
    }
  });

  it("Twinkle links Wikipedia's pinned revision", () => {
    const { text, href } = sourceLink(sources.twinkle);
    expect(text).toBe("Source: Wikipedia ↗");
    expect(href).toContain("oldid=1378689555");
  });

  it("names other hosts without www.", () => {
    expect(sourceLink("see https://www.example.org/x").text).toBe("Source: example.org ↗");
    expect(sourceLink("https://imslp.org/wiki/X").text).toBe("Source: IMSLP ↗");
  });

  it("Eric, citations without a URL, javascript: and relative strings get no href", () => {
    expect(sourceLink(" Eric ")).toEqual({ text: "Arranged by Eric", href: null });
    expect(sourceLink("Peters edition, 1890")).toEqual({ text: "Source: Peters edition, 1890", href: null });
    expect(sourceLink("javascript:alert(1)").href).toBeNull();
    expect(sourceLink("/songs/x").href).toBeNull();
  });
});

describe("SongSource", () => {
  it("renders a new-tab link with the full citation as its title, or plain text with the same test id", () => {
    const link = renderToStaticMarkup(<SongSource source={sources["clair-de-lune"]} />);
    expect(link).toMatch(/^<a data-testid="preview-source" href="https:\/\/www\.mutopiaproject\.org[^"]*id=1778" target="_blank" rel="noopener noreferrer" title="Mutopia 1778/);
    const plain = renderToStaticMarkup(<SongSource source="Eric" />);
    expect(plain).toMatch(/^<span data-testid="preview-source" title="Eric"/);
    expect(plain).toContain("Arranged by Eric");
  });
});
