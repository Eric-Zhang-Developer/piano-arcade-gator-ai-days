## What shipped
One cute chibi gator, variant A "the green loaf": a round head, a bean body, glossy eyes, blush and no teeth. It's on
the select's "Next for you" row, /learn and the results tutor, replacing two different gators. Five other kawaii
variants ship as files for a swap.
## Where it lives
- `web/public/learning/companion-gator.svg` (= `web/public/mascot/a-loaf.svg`)
- `web/public/mascot/`
- `web/src/game/duo-results/index.tsx` (`duoPanelSettings.gator`) and `mascot.test.ts`
- `specs/decisions/mascot-form.md`
## How to check it
`pnpm -C web exec vitest run src/game/duo-results src/game/duo-select`. Not verified locally in a browser; covered
by CI. Not seen by Eric in the app.
## Gaps
- No Lab entries; the spec cuts them.
- Two poses in use: the loaf, and the happy pose (D) on a tutor with no weak run.
- /learn wasn't shot.
- The old PNGs stay in `web/public/learning/`.
