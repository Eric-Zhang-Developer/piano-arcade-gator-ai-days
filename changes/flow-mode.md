## What shipped
`/play?mode=flow`: the song waits at each note and follows your tempo (0.5–1.3×), scored on wrong notes, skipped notes and stops past 2 beats, not timing. It adds a `♩ 92 · 115%` readout, a glow on the waiting note, "Take your time", "Play in Flow" on the start screen and a headline like `98% right notes · steady · 2 slips`. The beat is off.
## Where it lives
`web/src/game/flow-mode/` (clock.ts, judge.ts, steady.ts, index.tsx, verify-flow.mjs); the page wiring in `web/src/app/play/page.tsx` (#629); decisions `specs/decisions/flow-mode-tempo.md`, `flow-mode-judging.md`.
## How to check it
`verify: node web/src/game/flow-mode/verify-flow.mjs --out … pass at a6e8061 (uncommitted changes)`, the code in this PR, 9 of 9: hold with no presses, "Take your time" at 2 beats, rate 0.799 by the 8th note at 80%, no MISS, a "steady" headline. Unit tests: `pnpm -C web exec vitest run src/game/flow-mode` (18 pass).
## Gaps
Not tried on the piano: Validation 3 (Flower Dance and Clair de Lune on the DGX, tuning 0.5–1.3, 4 onsets, 2 free beats, 0.10/0.20 beat and the ease) is Eric's. No reduced-motion screenshot (the glow holds a fixed alpha there, untested). Rewind (← →) stays wait-only. Lab (#619) doesn't list Flow yet. The beat following the clock (Plan step 4) isn't built.
