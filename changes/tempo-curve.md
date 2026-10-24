## What shipped
A results panel with a second, rubato score: each note judged against a smooth tempo curve fitted to the take (triangle-weighted local fit, ±2 bars, tempo clamped to 50–150%), with the same windows and accuracy formula as strict. "Rubato score 93% · strict 12% · 82 to 99 BPM · 29 notes recovered from MISS". Strict results, rank and records are untouched.

## Where it lives
`web/src/game/tempo-curve/index.ts` (settings in `tempoCurveSettings`), its tests, `check-rubato.mjs` (the kept Playwright check), `specs/decisions/tempo-curve-strict-hits.md`, one line in `web/src/game/layers.ts`.

## How to check it
`verify: … pass at 39273bb`. `node web/src/game/tempo-curve/check-rubato.mjs <base-url>` plays Twinkle slowing from 100% to 80% through `?input=test` and requires rubato above strict: it read 93% against 12% (screenshot in `.git/agent-evidence/tempo-curve/`).

## Gaps
The piano check is Eric's and not done: play Chopin's Prelude with your own rubato and say whether the rubato score matches how it felt. In the browser run the last 3 slowed presses land after /play ends the song, so rubato reads 93%, not the unit test's 100%.
