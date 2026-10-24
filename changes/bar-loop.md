## What shipped
`/play?song=<id>&from=<bar>&to=<bar>&tempo=<percent>` plays only those bars (1-based, inclusive) at `tempo`% (25–150) of the chart's bpm. It repeats them `passes` times (default 4, `?passes=1–20`) with an empty bar before each repeat. Each pass is scored on its own, and a "Passes" panel next to the results lists each pass's accuracy in order. A bar range outside the chart shows an error, and without `from`/`to` nothing changes.

## Where it lives
`web/src/game/bar-loop/` (`index.ts`, `bar-loop.test.ts`) · one line in `web/src/game/layers.ts` (first, so later plugins see the looped chart) · `specs/decisions/bar-loop-passes.md`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/bar-loop/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/bar-loop/20261024T072346Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/bar-loop/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/bar-loop/20261024T072346Z/sim` pass at 0213caa (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/bar-loop/20261024T072346Z)
The spec's verify step, run headless (before the rebase onto 0213caa; the bar-loop code didn't change): `/play?song=twinkle&from=1&to=2&tempo=70&passes=2&input=test` with the Perfect player listed two passes at 100.0% and 14/14 PERFECT, at bpm 70. `from=1&to=99` showed "bars 1–99 aren't in this chart (bars 1–12)". Screenshots: .git/agent-evidence/bar-loop/check-072256/

## Gaps
- **"Until stopped" is a set of passes:** `/play` can't be stopped mid-song (`specs/decisions/bar-loop-passes.md`). A stop control would be a `fix(core-loop)`.
- **The headless check isn't in `[verify].command`:** that runs core-loop's `web/e2e/verify.mjs`, so the check above was run separately.
- **Not tried on the piano.**
- **No link from the coach yet:** that's the learning lane's to add.
