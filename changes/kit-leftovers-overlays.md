## What shipped
Three things drawn over a take now match the Duo kit:
- Learn mode's waiting note name is upright (no synthesized italic) at the same size (#1132).
- The two-hand L / R legend has square chips with the kit's data face, 16 px at 720 high and 24 px at 1080, and the chips grow with the letters (#1135).
- The notice toast is square, with its accent bar and timing unchanged (#1137).
## Where it lives
`web/src/game/wait-hint/index.ts` (`hintFont`), `web/src/game/hand-colors/index.ts`, `web/src/game/notice-toast/index.ts` (`toastCss`), and their tests. Shots: `specs/features/kit-leftovers-overlays/shots/`.
## How to check it
`pnpm -C web exec vitest run src/game/wait-hint src/game/hand-colors src/game/notice-toast`: 19 tests pass. The browser checks (`verify-wait-hint.mjs`, `verify-toast.mjs`) were not verified locally; covered by main's scheduled full run.
## Gaps
The bar numbers' italic (`bar-lines`) is left to #1122, as the spec says. The toast keeps its system-ui type and its cyan 1 px ring: the spec restyles nothing else in these files.
