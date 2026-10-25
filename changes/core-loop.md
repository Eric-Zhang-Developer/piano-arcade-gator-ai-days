## What shipped
`/play`: Twinkle (42 notes, 100 BPM) falls on a key-aligned canvas highway with a 4-beat count-in; every key press from Web MIDI, laptop keys or the test input is judged PERFECT/GREAT/MISS/extra by one pure judge, ending on a results screen (counts, accuracy, max combo, rank, Retry). Also: the Next.js 16 + pnpm skeleton, frozen contracts, `layers.ts`, real CI checks, and `[verify].command`.

## Where it lives
`web/src/contracts/index.ts` · `web/src/game/core/` (settings, judge, input, highway + tests) · `web/src/game/layers.ts` · `web/src/app/play/page.tsx` · `web/public/songs/twinkle/chart.json` · `web/e2e/verify.mjs` · `.github/workflows/ci.yml`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/core-loop/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/core-loop/20261024T051926Z` pass at 3ba635b (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/core-loop/20261024T051926Z)

## Gaps
Not verified on the piano (Web MIDI can't run headless): issue #39 asks Eric to play it on the DGX-660 and on laptop keys. Chart source is Wikipedia's CC BY-SA LilyPond of the public-domain melody, cross-checked against Mozart K.265 (`specs/decisions/core-loop-chart-source.md`). No visual polish (hud, juice-visual). `drawHighway` has no unit test; verify covers it.

## Perf, 2026-10-25 (#678)
At devicePixelRatio 2, /play went from 53 to 25 canvases and from 436 to 117 MP composited per frame, and JS frame work p95 from ~5 to ~3 ms (Apple M2, headless Chromium through Metal, `perf.mjs --dpr 2`, 3 runs each). Headless frame intervals read 16.7 ms before and after, so they can't show compositing; Eric's MacBook is the real check.
