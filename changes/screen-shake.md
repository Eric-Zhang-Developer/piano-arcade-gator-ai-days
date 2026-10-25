## What shipped
A Lab experiment, off by default: with `?x=screen-shake`, each combo milestone (25, 50, then every 100) shakes the highway and overlay canvases together. The peak is at most round(height / 180) px, it's exactly 0 from 250 ms, and there's no shake under reduced motion. It's listed in the Lab under Juice.
## Where it lives
`web/src/game/x/screen-shake/`, its line in `web/src/game/x/index.ts`, `specs/decisions/screen-shake-target.md`, `specs/features/experiments/shots/screen-shake/`.
## How to check it
vitest `src/game/x`: 24 passed. In the in-app browser, `/play?song=minuet-g&bot=fever&x=screen-shake` at 1920×1080 shook both canvases in step at combo 25 (about 17.5 s after load) and cleared to no transform. The same take without `?x=` and with reduced motion set no transform. verify-lab.mjs and web/e2e/verify.mjs: not verified locally; covered by main's scheduled full run. Not seen by Eric.
## Gaps
No clip: the in-app browser can't record, so the offset curve printed by the test and two frozen mid-shake frames are the evidence. The perf gate (`perf.mjs --params x=screen-shake`) wasn't run locally; main's scheduled run covers it. During a shake, the still background shows in a strip up to 6 px wide at the edge the canvases move away from. The cap and decay are the planner's guesses; Eric's look decides.
