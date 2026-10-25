## What shipped
A second music select at `/mt`: a coverflow of SongJackets (centred card flat, neighbours tilted and receding), drag, arrows or chevrons to move, Enter or a click on the centred card to play. The caption shows title, composer, catalog, notes, level and the local best grade. `/` is unchanged.

## Where it lives
`web/src/app/mt/` (`page.tsx`, `Coverflow.tsx`, `coverflow.module.css`, `motion.ts` + `motion.test.ts`, `verify-menu-test.mjs`); spacing and flick choices in `specs/decisions/menu-test-spacing.md`.

## How to check it
`verify: node web/src/app/mt/verify-menu-test.mjs --out <evidence> pass at a622d4d (uncommitted changes)`: 10 cards for 10 charts, no side scroll at 1440 or 375 px, Right x3 centres the fourth song, a drag past the last wraps to the first, Enter opens `/play?song=<id>`, and a recorded Twinkle take shows `S · 100.0%` on `/mt`.

## Gaps
The best-rank step plays Twinkle through `/play?input=test` (the test hook), not after Enter from `/mt`. Not tried on a real touch screen or with the piano. No link to `/mt` from `/` (Eric's lane).
