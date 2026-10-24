## What shipped
The HUD score rolls to each new value in 200 ms (ease-out, whole numbers, never down, restarting from what's shown
on dense charts), and the multiplier badge glows and settles from 1.15× in its new color for 250 ms on each tier-up
(not on a drop). Reduced motion: the score jumps, no flash. `HudState.score` stays exact at every event.
## Where it lives
`web/src/game/hud/index.ts` (`rollup`, `tierFlash`, `hudSettings.rollMs/flashMs`) and `hud.test.ts`, via #341;
frames in `specs/features/score-rollup/`; choices in `specs/decisions/score-rollup-capture.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (score-rollup, d16ac56); verify-hud passes
unchanged.
## Gaps
Frame timing in a headless browser isn't tested (the fake-context test is the gate). Eric's eye: not verified by Eric.
