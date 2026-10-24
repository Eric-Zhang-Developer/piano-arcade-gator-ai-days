## What shipped
A three.js synthwave stage behind the 2D highway on `/play`: a grid floor to a horizon a third down, a banded sun, and stars. The grid scrolls 1–4 lines per beat with the HUD's multiplier tier. Count-in beats flash it. Fever goes hot: orange grid, the sun swells, the stars streak. A miss or WRONG gives a 300 ms grey dip and tier 1 again. A full combo bursts a ring from the sun. It idles behind the results screen. Turn it off with `?stage=off` or `localStorage["pianoArcade.stage"]="off"`; it's also off without WebGL. Reduced motion gets one still frame.
## Where it lives
`web/src/game/stage/` (`index.ts` state and plugin, `scene.ts` three.js, `stage.test.ts`, `verify-stage.mjs`), one entry in `web/src/game/layers.ts`, `specs/decisions/fever-stage-luma-and-budget.md`. The `/play` hook it mounts on landed in #106.
## How to check it
`verify.py --slug fever-stage` passed at 6424ef9 (evidence `.git/agent-evidence/fever-stage/20261024T073551Z`). `node web/src/game/stage/verify-stage.mjs --out <dir>` passed: 42/42 PERFECT with the stage on (1 stage canvas) and with `?stage=off` (none). In Chrome on Eric's laptop:
- Six takes with five Retries kept one stage canvas. Its context was never lost, and the console showed no WebGL warning.
- Frame times measured with `requestAnimationFrame`: 6.9 ms mean per second after a 348 ms first frame.
- Fever on the Minuet looked hot (screenshot in #102).
## Gaps
- Not verified on the piano: Eric's "helps or distracts".
- Not seen live: the miss dip, the grid's scrolling and its speed steps. They're unit-tested only.
- The frame-time check wasn't recorded in DevTools' Performance panel (spec check 6). It was timed in-page, on the dev server.
- Lane luma is held by capping the stage canvas's opacity at 0.78, not measured per pixel.
