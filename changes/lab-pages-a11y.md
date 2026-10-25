## What shipped
The Lab's own pages get their basics (#1128, #1129, #1143, #1130). /real-keys gets a `Real Keys · Étude` tab title, one h1, a Lab link at the rail's head, and canvas labels in a font that resolves, with nothing under 12 px. /conduct announces its error (alert), its state (once per change, not per frame) and the hand tracker loading and ready. /highlight keeps Render's focus while it records, moves it to Save video when the reel is done, and announces the done line. The nav bar lights Lab on every experiment's page.

## Where it lives
`web/src/app/real-keys/layout.tsx`, `web/src/game/x/real-keys/RealKeys.tsx` and its CSS, `web/src/game/x/conductor/announce.tsx`, `web/src/game/x/highlight-reel/status.tsx` and `reel-check.mjs`, `web/src/game/nav-bar/slots.ts` (`EXPERIMENT_PAGES`); `specs/decisions/lab-pages-a11y-nav.md`.

## How to check it
`pnpm -C web exec vitest run src/game/x/real-keys src/game/x/conductor src/game/x/highlight-reel src/game/nav-bar src/game/x/x.test.tsx` (83 pass). Browser check `verify-highlight.mjs` (the keyboard render's focus, bar 0): not verified locally; covered by main's scheduled full run. Tried once by hand in the dev server: Enter on Render kept focus there while it recorded, then focus landed on Save video and the status read the done line.

## Gaps
No screen reader was run; the regions are checked as markup. /real-keys and /conduct were shot without a camera, so the corner labels' new font is checked by the source test, not seen.
