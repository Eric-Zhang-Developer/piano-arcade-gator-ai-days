// Song sources (spec: song-sources): the chart's cited score, one quiet line under the song preview, so "are these the
// real notes?" is one click away. Not setup text, so ?capture=1 keeps it.
import type { CSSProperties } from "react";

const NAMES: [string, string][] = [
  ["mutopiaproject.org", "Mutopia"],
  ["wikipedia.org", "Wikipedia"],
  ["imslp.org", "IMSLP"],
  ["musescore.com", "MuseScore"],
];

const siteName = (host: string) => NAMES.find(([d]) => host === d || host.endsWith(`.${d}`))?.[1] ?? host.replace(/^www\./, "");

// The first http(s) URL that isn't a license (creativecommons.org), ending at whitespace or ")". Anything else, a
// javascript: or relative string included, stays a plain citation with no href.
export function sourceLink(source: string): { text: string; href: string | null } {
  if (source.trim() === "Eric") return { text: "Arranged by Eric", href: null };
  for (const [url] of source.matchAll(/https?:\/\/[^\s)]+/g)) {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    if (host === "creativecommons.org" || host.endsWith(".creativecommons.org")) continue;
    return { text: `Source: ${siteName(host)} ↗`, href: url };
  }
  return { text: `Source: ${source}`, href: null };
}

export function SongSource({ source }: { source: string }) {
  const { text, href } = sourceLink(source);
  return href ? (
    <a data-testid="preview-source" href={href} target="_blank" rel="noopener noreferrer" title={source} style={line}>
      {text}
    </a>
  ) : (
    <span data-testid="preview-source" title={source} style={line}>
      {text}
    </span>
  );
}

// A footnote: the preview status line's size and color, one line with an ellipsis, never louder than the stats.
const line: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  margin: "0.3em 0 0",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  fontSize: "clamp(13px, 0.85vw, 17px)",
  lineHeight: "24px", // a 24 px tall target, the line's own height (#951)
  color: "var(--pa-ink-dim)",
  textDecoration: "none",
};
