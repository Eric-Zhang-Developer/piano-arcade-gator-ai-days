## What shipped
The results screen in the Duo look (F-duo-3), where the tutor visibly decides:
- Top band: the rank in corner brackets, the title, and six data cells (PERFECT gold, MISS grey, MAX COMBO blue). WRONG, EXTRA and the score are on one line under the title.
- Middle band: BY BAR, one cell per bar filled to its accuracy with the weakest bars bracketed, and TIMING, every hit's offset in 10 ms bins with `AVG +N MS LATE`.
- Bottom band: the gator, a template line from the take, and one primary `PRACTICE BARS X–Y` (bar-loop at 70%, keeping `hands`), or `NEXT SONG` on a clean take. Retry, Songs and the other actions sit beside it as kit buttons.
- After a scored take, the weak run is saved as "next for you" (`pianoArcade.nextFor.<song>`) for duo-select. Bot, demo and practice takes are never saved.
## Where it lives
- `web/src/game/duo-results/`: `scores.ts` (the numbers), `index.tsx` (the panels and the two plugins), `scores.test.ts`, `verify-results.mjs`.
- `web/src/game/results-layout/`: the bands. `web/src/game/layers.ts`: the two plugins.
- `specs/decisions/duo-results-weakest-run.md` and `duo-results-layout.md`. Look-loop shots: `specs/features/duo-results/shots/look/`.
## How to check it
`node web/src/game/duo-results/verify-results.mjs --out <dir>`: not verified locally; covered by main's scheduled full run (Eric's load rule, 2026-10-25). Validation 1: `scores.test.ts`, 15 of 15 passing. The Look loop was three rounds on a running dev server at 1280×720 and 1920×1080 (#710).
## Gaps
- **Validation 3, Eric on the DGX:** does the tutor line name the bars he'd agree were his weakest? Not tried yet.
- **The composer** under the title: the layout takes a `composer` prop, but `/play` passes it only after a one-line `fix(core-loop)`.
- **`nextStep(results)`** (#642) hasn't landed, so the panel shows the template line only.
- The Validation 2 screenshots come from main's scheduled full run, not from this PR.
