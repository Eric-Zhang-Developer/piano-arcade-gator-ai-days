## What shipped
A wait-mode take no longer looks scored. The judge's `{ scored: false }` sends no combo milestone, fever or full combo. The HUD band holds the song card, `n / N` (the note you're on) and a cyan LEARN badge. There is no fever meter, no end drumroll or rank hit, and no bar-loop Passes list (#288). Plain mode is unchanged.

## Where it lives
- `web/src/game/wait-hud/`, with a layer line after `hud()` in `web/src/game/layers.ts`.
- The fix: step (#288) is in `core/judge.ts`, `app/play/page.tsx`, `hud/`, `fever-gauge/`, `sound/` and `bar-loop/`.
- The look choices are in `specs/decisions/wait-hud-look.md`, and the before/after shots in `specs/features/wait-hud/shots/`.

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/wait-hud/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/wait-hud/20261024T124322Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/wait-hud/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/wait-hud/20261024T124322Z/sim` pass at a322bd1 (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/wait-hud/20261024T124322Z)
`node web/src/game/wait-hud/verify-wait-hud.mjs --out <dir>` passes: 1 / 42 at the first hold (1280 and 1920), 42 / 42 at the end, milestone null, no FULL COMBO, no Passes list on a wait-mode loop, no page errors. `verify-hud` and `verify-fever` pass.

## Gaps
- Not played on the piano. Eric's check: Für Elise in wait mode shows LEARN and the note count, never a score, and the end is silent but for the piano.
- `verify-hud` was failing on main before this work: a key outside the chart's range made a NaN glow that stopped the game. That is fixed by #286.
