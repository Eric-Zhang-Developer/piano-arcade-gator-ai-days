## What shipped
The select on `/` is now in sections that follow song-finder's sort: Level bands 01–03 to 10–15, Composer surnames, and Recent's played / not played yet. Each section has a header with its count. A chip strip above the list jumps to a section and focuses its first song. `12 / 40` counts the visible list. One-line rows sized in vh show 13 rows at 1920×1080 and 12 at 1280×720 (bars 12 and 8; there were 7). The panel's roll now fills the old dead band (61 px → 0).
## Where it lives
`web/src/game/main-page/` (`sectionsOf`, `Sections.tsx`, `verify-main.mjs`); `web/src/game/select-layout/`; `web/src/game/duo-select/` (SongRow, the panel's stretch); `specs/decisions/main-page-brief.md`, `main-page-bands.md`.
## How to check it
`node web/src/game/main-page/verify-main.mjs --out <dir>`: not verified locally; covered by main's scheduled full run. Vitest: main-page, song-finder, duo-select and select-layout (34 tests) pass.
## Gaps
- Composer's 18 chips wrap to 4 lines at 1280×720, which leaves 9 rows in view.
- A song is reached in at most 3 mouse actions (a chip, a scroll, a click). I reasoned that from the layout and did not time it with a player.
- Eric hasn't looked yet (Validation 5).
- Rung names ("Easy" to "Expert") stay off the screen until a decision maps levels to rungs.
