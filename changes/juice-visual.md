## What shipped
Hits flare white-hot where the note meets the line, with a short light pillar and wisps rising for about 1.5 s. PERFECT is brighter and denser than GREAT, and GREAT more than GOOD. Held hit notes stream sparks, pressed keys light their lane, and misses flash grey on the line. Fever glows the screen edges and top. FULL COMBO shows over a dimmed screen for 2 s, then the rank letter scales in. All of it is clipped out of every unplayed note due within 500 ms, and particles are capped at 300.

## Where it lives
`web/src/game/juice/` (`index.ts`, `particles.ts`, `particles.test.ts`) · one line in `web/src/game/layers.ts`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/juice-visual/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/juice-visual/20261024T071153Z && node /Users/ericzhang/.worktrees/gator-ai-days-2026/juice-visual/web/src/game/sim/verify-sim.mjs --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/juice-visual/20261024T071153Z/sim` pass at 611486e (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/juice-visual/20261024T071153Z)
Frames from a headless "Watch the bot" run (mid-song flare and wisps, FULL COMBO, rank): /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/juice-visual/frames-611486e

## Gaps
- **No fever screenshot.** Fever needs a 50 combo and the only chart, Twinkle, has 42 notes. Fever is drawn but has never been seen in play.
- **Not in verify.** The spec wants verify screenshots, but `web/e2e/verify.mjs` is core-loop's file. These frames come from a separate headless run.
- **Not verified on the piano:** Eric judges the feel.
- **The rank reveal styles core's `[data-testid="rank"]`** rather than editing the results screen.
- **The clear zone is approximate:** it uses the key's full width and the flat highway's scroll rate, so with perspective above 0 it is a little off.
- **If #93 merges,** the three.js stage owns the fever background, and this plugin's top glow should go.
