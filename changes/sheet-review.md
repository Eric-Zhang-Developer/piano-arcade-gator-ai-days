## What shipped
"Review on sheet ↗" on the results opens `/sheet?song=<id>&review=1`: the take just played, every note in its judgment color, PERFECT/GREAT/GOOD/MISS counts in the legend, no cursor. It is stored in this browser (the latest take only) and hidden in capture mode.
## Where it lives
`web/src/game/sheet-review/` (`review.ts`, `index.tsx`, `verify-review.mjs`), `web/src/game/sheet-view/SheetView.tsx` (the `review=1` mode), `web/src/game/results-layout/` (the button in the actions row).
## How to check it
`node web/src/game/sheet-review/verify-review.mjs --out <dir>`: a rank-C take's colored counts equal its results' (PERFECT 30, GREAT 4, GOOD 0, MISS 8), then a perfect retry reuses the window and shows MISS 0. `verify.py --slug sheet-review` passes.
## Gaps
Not tried on the piano: Eric's Ode to Joy check (are the MISS heads the notes missed?) is open. Not tried in real Chrome, only headless Chromium. Pedal marks aren't carried. Same browser only.
