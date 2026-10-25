---
name: "Main page: the music select laid out for a 40-song library, in sections that follow the finder's sort"
depends_on: ["song-finder", "duo-select", "nav-bar", "mouse-first", "song-pack-5", "song-pack-6", "song-pack-7", "song-pack-8"]
owns: ["web/src/game/main-page/", "specs/features/main-page/", "changes/main-page.md", "specs/decisions/main-page-"]
assignee: "eric"
---

# Main page

Issue #851. Eric, 2026-10-25: "Another thing would be probably about 20 more songs, but then we would probably have to
sort songs, and also we would have to redo our main page." The issue: "The select at 40+ songs on the Duo kit.
Overlaps nav-bar, duo-select and mouse-first (#772); build on them, not around them."

The sort and the search are song-finder's (#850), not this feature's. This one is the rest of `/` at about 40 songs:
how the list reads, how a player gets across it by mouse, and the frame around it.

## End state
`/` with the whole library on main (about 40 songs after packs 5 to 8) reads as one designed screen at 1280×720 and
1920×1080. The list is in sections that follow song-finder's sort, a strip of section chips jumps to any section in
one click, and the frame around the list (the top band, the panel column, the footer links) has no dead space.

## What exists (origin/main, 2026-10-25)
- **`/`** (`web/src/app/page.tsx`, song-select's): `MusicSelect` with a footer of `OptionsDrawer`, `FirstRunLink`
  and `LabLink`, then `AccountChip` (sharan's lane) and `BuildStamp`.
- **`MusicSelect`** (`web/src/game/select-layout/index.tsx`): a top band with the wordmark and `HelpLink`, the left
  column (`FocusPanel` from duo-select, then the footer), and the right column, an `<ol>` of `SongRow`s that scrolls
  inside itself. ↑/↓ keep the focused row centered.
- **duo-select's gap:** its done note says the look loop "leaves a dead band under the panel at 1920×1080".
- **nav-bar:** a thin bar centered in the top band (#963, open, gives it its own band on pages that scroll).
- **song-finder:** part 1 (#928, merged) has `sortSongs` and `filterSongs` in `web/src/game/song-finder/`; part 2
  (#965, open) puts the sort chips and the search box in the list column. Its spec: "no grouping headers unless the
  design pass asks for them". This feature is that ask.
- **Levels** are numbers 1 to 15 (`web/src/game/difficulty/`). No code names a rung ("Easy", "Medium"): the song-pack
  specs do, in prose.

## Plan
1. **Research first (the worker's).** Before any code, invoke `frontend-design` and `design-taste-frontend`, then:
   - measure today's `/` with the library on main: how many rows show at once at 1280×720 and 1920×1080, how far the
     list scrolls, and where the dead band is;
   - study how rhythm-game selects with large libraries are laid out and crossed by mouse: Chunithm (the committed
     notes in `specs/context/reference-notes/chunithm-*.md`), and two or three more of the worker's choice (maimai,
     Sound Voltex, osu!, Beat Saber, Synthesia's song list) from public screenshots or videos.
   Write the findings and the directions taken and dropped in **`specs/decisions/main-page-brief.md`** and commit it
   before the first code commit. Notes only: never commit frames from other games (decision 003).
2. **`feat(main-page)`, part 1:** `web/src/game/main-page/` with the pure part and a vitest: `sectionsOf(songs,
   sort)`, from song-finder's sorted list to labeled sections (Requirements).
3. **Part 2, the screen:** the sections, the chip strip and the frame on `/`, then `verify-main.mjs`, the design
   pass and the done note. This reaches other features' files through the lane rule (below).

**Lane rule.** All of these are `eric`'s lane, so this feature may change them while no open PR is working on them.
Check `gh pr list` and each open PR's files first. #600 (abbasi2010) is stale and doesn't block, but keep the diffs
narrow.

| Files | Owner | What changes |
|---|---|---|
| `web/src/game/select-layout/` | select-layout | the list's sections, the chip strip, the frame |
| `web/src/game/duo-select/` | duo-select | `SongRow` and `FocusPanel` density, only if the layout needs it |
| `web/src/game/song-finder/` | song-finder | where its controls sit; its sort and filter rules don't change |
| `web/src/app/page.tsx` | song-select | the footer's order and grouping |
| `web/src/game/nav-bar/` | nav-bar | only its placement in the top band |

`AccountChip` is sharan's (`web/src/app/auth/`): don't change it. If the layout needs it elsewhere, file a
`needs-human` issue for `sharan` and leave it where it is.

## Requirements
- **Sections follow the sort.** One header per section, in the Duo kit's monospace label:
  - **Level:** bands of levels, labeled by number (`LV 01–03`), never by a rung name no code defines. The worker
    picks the bands so no band is empty or holds most of the library, and logs them.
  - **Composer:** one section per surname, by song-finder's surname rule.
  - **Recent:** played and not played yet.
  - **A search** shows its matches with their section headers; a section with no match is hidden.
- **The chip strip:** one chip per section of the current sort, above the list. A click scrolls the list to that
  section and focuses its first song. It's a mouse control first (mouse-first): no key hint on the screen; a
  shortcut, if any, goes on the `?` card.
- **Where you are:** the list shows the focused song's place and the count (`12 / 40`), counted from the visible list.
- **The frame:** no dead band under the panel at either size, and the footer's links (Options, First time, Lab) sit
  together in one place. The page never scrolls; the list scrolls inside its column, as today.
- **Nothing that works today breaks:** ↑/↓ cross section headers as if they weren't there; Enter, P, L, W and E act
  on the focused song; hover still focuses; the first row still takes focus on load; `?capture=1` still hides what it
  hides.
- **No data changes:** `loadSongs()`'s output, the chart contract and song-finder's sort and filter results stay as
  they are. Every number on the screen is a real count.
- **The Duo kit** (`web/src/game/duo-tokens/`) for every header, chip and label; anything it lacks goes into the kit
  through a `fix(duo-tokens)`, not locally. Text a viewer must read is at least 24 px at 1920×1080 and 16 px at
  1280×720 (`visual-direction.md`).
- **Reduced motion:** the chip's scroll jumps instead of easing.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/main-page src/game/song-finder src/game/duo-select`:
   `sectionsOf` covers each sort, ties, an empty list, a search that empties a section, and a 40-song list built in
   the test from `Song` objects (test data only, never shown on a page). The existing tests pass.
2. `web/src/game/main-page/verify-main.mjs`, run by CI (AGENTS.md load rule: no local browser run; the done note says
   "not verified locally; covered by main's scheduled full run"):
   1. Open `/` -> section headers show in Level order; the first row is focused.
   2. Click the last chip -> the list shows that section's first song, and it's focused.
   3. Press ↓ from a section's last song -> the next section's first song is focused.
   4. Choose Composer -> the chips are surnames; type `chopin` -> only the Chopin section shows.
   5. At 1280×720 and 1920×1080 -> the page doesn't scroll, and no text a viewer must read is under the sizes above.
3. **Planner's bars, not measured** (the brief records today's numbers; the done note says whether each was met):
   - at least 12 rows show at once at 1920×1080, and at least 8 at 1280×720;
   - any song is reached in at most 3 mouse actions from load (a chip, a scroll, a click).
4. The design pass (AGENTS.md, Visible changes): shots at 1280×720 and 1920×1080 plus reduced motion, scored on taste
   v2's `references/critique.md`, at most three rounds, the scores and the before/after shots in the PR's Design
   section. Name the song count on main in the PR.
5. Eric looks at it once (mark it in the done note). His look doesn't block the merge.

## Gaps and defaults
- **Open:** whether Eric wants the rung names ("Easy" to "Expert") on screen. They'd need a contract or a decision
  that maps levels to rungs; until then the headers are numbers.
- **If a song pack stalls** (a `needs-info` on its sources), the planner may drop it from `depends_on`; the PR then
  names the song count it was designed at.
- Prefer the smaller option: section headers and a chip strip over a new screen, a grid or a carousel. A carousel or
  a second screen needs the planner first.
- If the spec is silent, take the smaller, reversible option and log it in `specs/decisions/main-page-<topic>.md`.
