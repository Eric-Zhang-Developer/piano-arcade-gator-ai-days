## What shipped
Fever's start is now a moment, done within 2 s:
- The sun-gradient edge flash peaks in 200 ms, stays above 0.75 of the line, and fades into juice's steady glow.
- A FEVER banner sweeps through the HUD band over an opaque cover.
- The stage's grid flashes (#300).
- `feverEnd` ends it at once, a later `feverStart` replays it, and `songStart`, `quit` and `songEnd` clear it.
- Reduced motion: no flash and no sweep; the banner shows still for 1 s.
- Also #297 (#280): juice's steady fever edges no longer cover the edge lanes near the line.

## Where it lives
- `web/src/game/fever-moment/`, with one layer line between `hud()` and `beatTrack()`.
- The stage flash is in `web/src/game/stage/index.ts` (#300) and the edge clip in `web/src/game/juice/index.ts` (#297).
- The look choices are in `specs/decisions/fever-moment-look.md`, and the shots in `specs/features/fever-moment/shots/`.

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/fever-moment/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/fever-moment/20261024T130340Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/fever-moment/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/fever-moment/20261024T130340Z/sim` pass at 6838be4 (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/fever-moment/20261024T130340Z)
`node web/src/game/fever-moment/verify-moment.mjs --out <dir>` passes, with last-drawn times after the start:
- minuet-g with `bot=fever`: 1987 ms at 1920 and 1977 ms at 1280.
- Reduced motion: 986 ms, within 1 s.
- maple-leaf-rag with `bot=perfect` at 1920: 1995 ms.

## Gaps
- Not verified by Eric. His eye check: does fever's start read as a moment?
- The flash lies over far, dim notes at the top of the edge lanes (above 0.75 of the line, as the spec allows). The look review didn't find it hiding anything.
- The stage's grid flash isn't visible in headless shots: verify-stage freezes the stage, and the flash lasts 150 ms.
