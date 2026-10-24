## What shipped
Chunk practice. A plain take's start screen has "Practice in chunks". It walks the song 4 bars at a time: learn each chunk in wait mode at 70%, then play it judged at 70% (bar-loop's URLs plus `practice=1`). At 85% accuracy, the focused "Next: bars 5–8" goes on, and after the last chunk "Play the whole song" does. Below 85%, a meter with the gate tick and "Learn bars 1–4 again" show, and Retry keeps focus. A practice step's start screen reads `Chunk 2 of 3 · learn`, with one pip per chunk. Chunks with none of the played hand's notes are skipped.
## Where it lives
`web/src/game/chunk-practice/` (`chunks.ts` logic, `index.tsx` plugin and panels, `verify-chunks.mjs`) · one line in `web/src/game/layers.ts`, before `barLoop()` · `specs/decisions/chunk-practice-labels-and-scroll.md`
## How to check it
`node web/src/game/chunk-practice/verify-chunks.mjs --out <dir>` prints `verify-chunks: pass` (screens in `specs/features/chunk-practice/screens/`). `verify.py --slug chunk-practice`: pass at 07d7494.
## Gaps
- **Not tried on the piano.** That check is Eric's: Für Elise's first chunk, learned, played at 70%, then moving on at 85%.
- **Results layout.** results-layout isn't wired into /play yet. Once it is, this panel becomes a card in its details unless `chunk-practice` joins its `actions`; the effect still centres it.
- **Starting values.** 4 bars, 70% and 85% are starting values for Eric to tune. The panels add no motion, so reduced motion looks the same.
