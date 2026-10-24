---
name: "Song sources: the song preview links each chart's public-domain score, the proof click"
depends_on: ["song-preview"]
owns: ["web/src/game/song-sources/"]
assignee: "eric"
---

# Song sources

A judge asks "are these the real notes?" Every chart's `source` already cites its score, but no screen shows it.
This puts one link in the music select's song preview, so the answer is one click away.

Issue: #369

## Plan
1. **`feat(song-sources)`:** add `web/src/game/song-sources/`. It holds a pure `sourceLink(source)` and a
   `<SongSource source>` component with its test. Nothing mounts it yet.
2. **`fix(song-preview)`:** `SongPreview` renders `<SongSource source={chart.source} />` under its row, once the chart
   it already fetches has loaded. No new fetch, and no change to `Song` or `select-layout`.
3. **`feat(song-sources)`:** the verify script, screenshots and the done note.

## Requirements
- **`sourceLink(source)`** returns `{ text, href }`:
  - `source` is exactly `"Eric"` (trimmed): `text` "Arranged by Eric", `href` null.
  - Otherwise, take the first `http://` or `https://` URL in the string, ending at whitespace or `)`, that isn't on
    `creativecommons.org` (that one is a license). `text` is "Source: <name> ↗". `<name>` comes from the host:
    `mutopiaproject.org` gives Mutopia, `wikipedia.org` gives Wikipedia, `imslp.org` gives IMSLP, `musescore.com`
    gives MuseScore, and any other host is shown without `www.`.
  - No such URL: `text` is "Source: " plus the citation as written, and `href` is null.
  - Nothing else is ever an `href`: a `javascript:` or relative string is shown as a citation.
- **Today's ten charts:** nine link to Mutopia. Twinkle links to Wikipedia's revision-pinned URL, because its notes
  were transcribed from there. Its Mozart cross-check stays in the tooltip.
- **The link:** `<a data-testid="preview-source" href target="_blank" rel="noopener noreferrer">`. The full `source`
  string goes in `title`. A citation without a link is plain text with the same test id. It's visible under
  `?capture=1`, since it's the proof and not setup text.
- **Look:** body face, `--pa-ink-dim`, the preview status line's size, one line with an ellipsis. It's a quiet
  footnote, never louder than the stats. Keyboard: Tab reaches it, and ↑ ↓ and Enter on the list don't change.

## Validation
- `pnpm -C web test`: `sourceLink` on every `chart.json` under `web/public/songs/` gives a non-null `href`, its
  first non-license URL. Moonlight's and Nocturne's links are Mutopia, not Creative Commons. Twinkle's is the
  `oldid=1378689555` URL. `"Eric"` gives "Arranged by Eric". A citation with no URL gives no `href`, and so do
  `javascript:alert(1)` and `/songs/x`.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/song-sources/verify-sources.mjs --out <dir>`. It starts its own dev server, prints
  `verify-sources: pass` and exits 0, or names each failure and exits 1:
  1. `/` -> focus each song card in turn (↓) -> `preview-source`'s `href` equals that chart's first non-license URL,
     and its text starts with "Source: ".
  2. A click on Twinkle's link opens a new page at the Wikipedia URL. Route it to a stub, so the check works offline.
  3. Screenshots of the focused column at 1280×720 and 1920×1080, plus one with reduced motion, kept in `<dir>`.
- `node web/src/game/song-preview/verify-preview.mjs --out <dir>` passes unchanged, and `verify.py --slug
  song-sources` passes.
- Eric's look: on `/` at the booth screen, the source line reads, and it doesn't crowd LEARN or PRACTICE 70%.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2
(`design-taste-frontend`) step 8, "Look": 1280×720 and 1920×1080, plus reduced motion. Before and after screenshots
go in the PR.

## Defaults
- One link per chart: the first score URL. Licenses and credits belong in `CREDITS.md`, not on this line.
- No link on the stage card or the results screen. Add one there only if Eric asks.
- If another `fix(song-preview)` is open, rebase on whichever lands first.
