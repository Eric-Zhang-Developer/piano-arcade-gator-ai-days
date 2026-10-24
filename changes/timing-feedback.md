## What shipped
The results screen now says how early or late you played: mean offset and spread, early/late counts, how many misses were near misses (the right key within 100 / 150 ms), and a "Set latency offset to N ms" button when 10+ timed presses average 10 ms or more off. Computed by a pure function from the take, so the learning lane can reuse it.

## Where it lives
`web/src/game/timing/index.ts` (+ `timing.test.ts`) · `web/src/app/play/page.tsx` (keeps the take, renders the panel)

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/timing-feedback/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/timing-feedback/20261024T060704Z` pass at 5786d9f (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/timing-feedback/20261024T060704Z)

## Gaps
Not verified on the piano: Eric's two-run check (read the line, apply the suggestion, play again) is still to do. The spec's near-miss example was wrong (+72 ms is within 100 ms) and is corrected to +120 ms. A mixed headless take (mostly +35–45 ms, near misses at +80 and +130, one at +300) showed "Late by 43 ms, spread ±16 ms · 0 early · 41 late · 1 of 3 misses within 100 ms (2 within 150 ms)", and the button saved 43. On short windows (~720 px) the latency slider sits over the keyboard drawing. No live FAST/SLOW and no GOOD tier (out of scope by spec).
