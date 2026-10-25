## What shipped
The music select can be sorted by Level (the default, today's order), Composer (by surname, then level) or Recent (newest finished take first, then never-played songs in Level order), and filtered by typing: case and accents don't matter, and every typed word must match the title, composer or catalog. Focus stays on the focused song if it's still shown, else moves to the first shown song. A no-match filter shows one line with Clear. The sort survives a reload; the search text doesn't. Every finished take except bots and demos stamps `pianoArcade.lastPlayed`.
## Where it lives
`web/src/game/song-finder/` (`index.ts` for the pure sort, filter and stores, `Finder.tsx`, `finder.module.css`, two vitests, `verify-finder.mjs`). The finder lines are in `web/src/game/select-layout/index.tsx`, and the lastPlayed write is in `web/src/game/records/index.ts`. Also `specs/decisions/song-finder-ui.md`, and shots in `specs/features/song-finder/`.
## How to check it
`pnpm -C web exec vitest run src/game/song-finder src/game/records`: 27 pass. `verify-finder.mjs` is not verified locally; it's covered by main's scheduled full run. Sorting, filtering, no match and keeping focus across a sort were seen in the in-app browser at 1280×720 and 1920×1080. Not tried by Eric on the DGX.
## Gaps
- Keeping focus across a reload was checked only in code and in `verify-finder.mjs`, because focus events don't fire in a hidden in-app browser pane.
- #600 also edits `select-layout/index.tsx` and `records/index.ts`, and it rebases onto this.
