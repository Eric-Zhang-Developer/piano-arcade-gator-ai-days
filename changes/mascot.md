## What shipped
One flat chibi gator, variant A "the flat pebble": four primary-blue shapes, mask cut-outs and one ink tooth. It's
on the select's "Next for you" row, /learn and the results tutor, replacing two different gators. Seven other
directions ship as files for a swap.
## Where it lives
- `web/public/learning/companion-gator.svg` (= `web/public/mascot/a-flat.svg`)
- `web/public/mascot/`
- `web/src/game/duo-results/index.tsx` (`duoPanelSettings.gator`) and `mascot.test.ts`
- `specs/decisions/mascot-form.md`
## How to check it
`pnpm -C web exec vitest run src/game/duo-results src/game/duo-select`. The browser checks (`verify-results`,
`verify-select`) were not verified locally; they're covered by main's scheduled full run. Not seen by Eric.
## Gaps
- No Lab entries; the spec cuts them.
- One pose only.
- /learn wasn't shot: its gator sits past the diagnostic.
- The old PNGs stay in `web/public/learning/`.
