## What shipped
`/play?mode=wait`: the highway stops on each note (a chord waits for all its keys), never calls a MISS, plays no beat, and ends on "Wait mode: not scored" with no rank, counts or timing panel. "Learn it first" on the start screen and "Play it judged" after the take switch modes and keep every other param. Takes in wait mode aren't saved as records.
## Where it lives
`web/src/game/wait-mode/` (`shouldHold`, `holdClock`, the panels, `verify-wait.mjs`); the hold in `web/src/app/play/page.tsx` (#219); no beat in `web/src/game/beat/` (#220).
## How to check it
`verify: … pass at 9309103` (verify.py --slug wait-mode, plain mode unchanged), and `node web/src/game/wait-mode/verify-wait.mjs --out <dir>`: 13/13. Chrome steps 1–3 are covered headless: a 3 s hold on Twinkle's first note, Play it judged opens the normal game, and Ode to Joy's opening chord waits for both keys.
## Gaps
Not tried on the piano yet (Eric: learn Für Elise's first two bars in wait mode, then play them judged). The HUD still counts PERFECTs and score during a wait-mode take, and FULL COMBO still fires (hud and juice don't read `mode`). Chrome steps were run headless in Playwright, not by hand.
