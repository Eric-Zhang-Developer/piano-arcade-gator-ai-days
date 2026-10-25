## What shipped
The DGX pages let go on Stop, pause and leaving: the round's pause, speaking-piano's and the conductor's Stop send All
Notes Off and pedal up now and again after their lookahead (#1310-#1312); demo-reset's Shift+Esc and idle return lift
the pedal too (#1313); /inside, /composers-hands and /speak start one run at a time, and a Stop or leave mid-await
starts none (#1314). One `silence()` and `runGuard()` in `x/composers-hands/rolls.ts` serve them all.
## Where it lives
`web/src/game/x/{round,speaking-piano,conductor,inside,composers-hands}/`, `web/src/game/demo-reset/index.tsx`,
`specs/decisions/lab-midi-release-pagehide.md`.
## How to check it
`pnpm -C web exec vitest run src/game/x/round src/game/x/speaking-piano src/game/x/conductor src/game/scenes src/game/demo-reset src/game/x/inside src/game/x/composers-hands`
(119 pass; each new test fails on main). Not verified on the DGX.
## Gaps
A plain reload or link away from a bot demo still leaves its pedal down: that's `scenes/index.ts`'s pagehide, held by
#600. #1314 is tested on the play pattern with fake timers, not on rendered pages (no DOM test environment here).
