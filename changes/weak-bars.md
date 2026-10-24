## What shipped
A results panel shows accuracy per two-bar phrase, marks the weakest (earliest on a tie), and links "Practice bars 11–12 at 80%" to bar-loop on those bars. A clean take says "No weak bars"; a bar-loop take shows no strip.

## Where it lives
`web/src/game/weak-bars/index.ts` (settings in `weakBarsSettings`), `web/src/game/weak-bars/weak-bars.test.tsx`, one line in `web/src/game/layers.ts`.

## How to check it
`verify: … pass at 7dd1b92`. Headless Chrome, `.git/agent-evidence/weak-bars/`: Twinkle `?bot=rank-c` → six cells, bars 11–12 (57%) marked; Practice opens `/play?song=twinkle&from=11&to=12&tempo=80` and bar-loop plays it; `?bot=perfect` → "No weak bars".

## Gaps
The piano check is Eric's and not done: play Für Elise and say whether the phrase it picks is the one you stumbled on. `hands` is carried into the link but no feature sets it yet, so that path is only unit-tested.
