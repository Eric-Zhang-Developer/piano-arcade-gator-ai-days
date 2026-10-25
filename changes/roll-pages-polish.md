## What shipped
/sonata's wordmark, count and caption are upright. Its live readout holds only the selected PR's lines, with the links outside it, and the roll is a slider with a short valuetext (#1204, #1205). Every stop on /composers-hands clears the port's queue, sends All Notes Off and CC64 0 now and again 150 ms later, and closing the tab also stops it. Its status line is a polite status region (#1206, #1207).
## Where it lives
`web/src/game/x/build-sonata/` (SonataPage.tsx, sonata.module.css), `web/src/game/x/composers-hands/` (rolls.ts `silence`, ComposersHands.tsx `StatusLine`), `specs/decisions/roll-pages-polish-roll-role.md`.
## How to check it
`pnpm -C web exec vitest run src/game/x/build-sonata src/game/x/composers-hands` (30 pass). Browser: not verified locally; covered by main's scheduled full run.
## Gaps
No reduced-motion shot: the in-app browser can't emulate it. This change touches no motion, and the rise only runs under `no-preference`, so a reduced-motion user sees the settled frame from the after shots. /composers-hands' title breaking at "C-|sharp" and its wrapping eyebrow were left alone: the spec keeps the look.
