## What shipped
An arcade HUD on `/play`, driven only by GameEvents. A top panel holds the song card, live PERFECT/GREAT/MISS/EXTRA counters, the score, and an x1–x4 multiplier: a color per tier, with pips toward the next. A giant translucent combo shows from 5, with a swell and a fading ghost at each milestone. Nothing reaches the lowest 40% of the highway.
## Where it lives
`web/src/game/hud/` (`index.ts`, `hud.test.ts`, `verify-hud.mjs`), one line in `web/src/game/layers.ts`, `specs/decisions/hud-look.md`
## How to check it
`pnpm -C web verify` passed at 4db197b (evidence `.git/agent-evidence/hud/20261024T063507Z`). `node web/src/game/hud/verify-hud.mjs --out <dir>` passed: the HUD matched the results screen (20/21/1/1, score 7,250), mid-song screenshot `hud-mid-song.png`.
## Gaps
Not done: Eric's readability check on the piano. The combo draws over the notes at 20% opacity, not behind them: plugin layers sit above the highway. Found, not fixed here: beat-track's laptop click can throw on Start and stop the game (a separate `fix(beat-track)`).
