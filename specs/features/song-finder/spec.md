---
name: "Song finder: sort the select by level, composer or recently played, and filter it by typing"
depends_on: ["duo-select", "records", "difficulty", "mouse-first"]
owns: ["web/src/game/song-finder/", "specs/features/song-finder/", "changes/song-finder.md", "specs/decisions/song-finder-"]
assignee: "eric"
---

# Song finder

Issue #850. Eric, 2026-10-25: "Another thing would be probably about 20 more songs, but then we would probably have to
sort songs". The issue: "Sort by level, composer and recently played; maybe a filter or search." Packs 5 to 8 (#849)
take the library from 20 songs to about 40, and today's select is one fixed list, easiest first.

The issue's other dependency, the level fix (#821: Moonlight 3 at its measured tempo, the levels following), merged
as #854, so Level order is already the one a human expects.

## What exists (origin/main, 2026-10-25)
- **The list:** `loadSongs()` (`web/src/game/song-select/load.ts`) reads every chart at build time and sorts it by
  `level`, then `title`. Each `Song` has `id`, `title`, `composer`, `catalog`, `noteCount`, `level` and `roll`.
- **The select:** `MusicSelect` (`web/src/game/select-layout/index.tsx`, mounted by `web/src/app/page.tsx`) keeps a
  `focused` index into `songs` and renders an `<ol>` of `SongRow`s (`duo-select/Select.tsx`). Its keys (P, L, W, E
  and the rest) act on the focused song.
- **Records** (`web/src/game/records/`): the best grade and a top 5 per chart, written at `songEnd` in
  `records/index.ts`. Neither says when a song was last played: a take that makes neither list leaves no trace.

## Plan
1. **`feat(song-finder)`, part 1:** `web/src/game/song-finder/` with the pure parts and a vitest: `sortSongs(songs,
   mode, lastPlayed)`, `filterSongs(songs, query)`, and the `lastPlayed` store (read, write, one localStorage key).
2. **Part 2, the screen:** a sort control and a search box on the select, wired into `MusicSelect`, and the one
   `lastPlayed` write in `records/index.ts`. Both files are this lane's (`eric`), so the lane rule lets this feature
   change them while no open PR is working on them: check `gh pr list` and each open PR's files first (duo-select's
   #915 touches the select). Then `verify-finder.mjs`, the design pass, the screenshots and the done note.

## Requirements
- **Three sorts**, one control, Level first:
  - **Level** (the default): today's order, `level` then `title`. Nothing changes for a player who never touches it.
  - **Composer:** by surname, then `level`. The surname is the last word of `composer` before any parenthesis, so
    "Christian Petzold (attributed; formerly J. S. Bach)" sorts as Petzold and "Ludwig van Beethoven" as Beethoven.
  - **Recent:** most recently played first, by `lastPlayed`; songs never played follow, in Level order.
- **`lastPlayed`:** one localStorage key, `pianoArcade.lastPlayed`, a map from song id to an ISO time. It's written
  at every finished take, practice included, beside the records write; Easy and Normal share one entry per song.
  Bot and demo takes don't count. Unreadable or blocked storage means Recent falls back to Level order, never an error.
- **Filter:** one search box (`<input type="search">`). It keeps the songs whose title, composer or catalog contains
  every typed word, ignoring case and accents ("fur elise" finds "Für Elise", "gymnopedie" finds "Gymnopédie").
  Empty shows everything. No match shows one line saying so, with a way to clear it.
- **Focus follows the visible list:** sorting or filtering keeps the focused song if it's still shown; otherwise the
  first shown song takes focus. ↑/↓, Enter and every select key keep working on the visible list.
- **Typing in the search box never triggers a select shortcut** (P, L, W, E and the rest).
- **The sort choice persists** on this device (one localStorage key); the filter text doesn't survive a reload.
- **The Duo kit** (`web/src/game/duo-tokens/`) for the control and the box. Every action works by mouse (mouse-first),
  and no key hint goes on screen; a shortcut, if any, goes on the ? card.
- **Not this feature:** the main page redo (#851). The finder sits in the select's list column and moves nothing else.
- No change to `loadSongs()`'s output or the chart contract.

## Validation
- `pnpm -C web test`: the song-finder vitest covers each sort (ties included), the surname rule on every composer in
  the library, accent- and case-blind matching, multi-word queries, and `lastPlayed` with empty, broken and blocked
  storage.
- `web/src/game/song-finder/verify-finder.mjs`, run by CI (AGENTS.md load rule: no local browser run; the done note
  says "not verified locally; covered by main's scheduled full run"):
  1. Open `/` -> the list is in Level order, as today.
  2. Choose Composer -> the rows run by surname; the three Chopin songs sit together.
  3. Type `chopin` -> only songs whose composer is Chopin show; the focused row is one of them.
  4. Type `zzz` -> the no-match line shows; clear it -> every song is back.
  5. Finish a take of the last song in Level order, return to `/`, choose Recent -> that song is first.
  6. Reload -> the sort is still Recent; the search box is empty.
  7. Focus the search box and type `p` -> no practice starts.
- The design pass (AGENTS.md, Visible changes): screenshots at 1280×720 and 1920×1080, the scores and fixes in the
  PR's Design section.
- Eric, on the DGX (mark it in the done note): find a song by sorting, then by typing, without the keyboard.

## Defaults
- Prefer the smaller option: a row of three buttons over a dropdown, and no grouping headers unless the design pass
  asks for them.
- If the spec is silent, take the smaller, reversible option and log it in `specs/decisions/song-finder-<topic>.md`.
