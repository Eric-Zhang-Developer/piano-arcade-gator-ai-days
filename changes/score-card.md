## What shipped
**Save card** on the results downloads a 1920×1080 PNG of the take, drawn on a canvas with no request.
- The card shows the song, the rank, score, accuracy, max combo, the six counts and the date.
- A practice take adds its practice line.
- The file is named `piano-arcade-<song>-<date>-<rank>.png`.
- The button sits in the actions row beside Retry, Review on sheet and Songs (#575, #609).
## Where it lives
- `web/src/game/score-card/`: `card.ts` (model and drawing), `index.tsx` (the plugin and its button), `score-card.test.ts` and `verify-card.mjs`.
- One line in `layers.ts`, and `"score-card"` in results-layout's `actions`.
- `specs/decisions/score-card-layout.md`.
## How to check it
`verify: node web/src/game/score-card/verify-card.mjs --out <dir> pass at ea35735`
- 12 steps over Twinkle S, Twinkle C and Für Elise D: one download each, no request after the click, 1920×1080, and the rank gold within ΔE76 0.
- `verify.py --slug score-card` passes, and so do the unit tests (7/7).
- The cards are in `specs/features/score-card/`.
## Gaps
- Results at 1280×720 were checked by screenshot on #609's merge, with Save card in the first view (y=587). They weren't checked by results-layout's own script, which doesn't exist.
- Eric's eye: not verified by Eric. Still to do: save a card after a piano take and open it on the phone.
