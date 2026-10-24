## What shipped
Judging that punishes what a listener hears as wrong: GOOD (50–100 ms) keeps the combo; a WRONG note (an extra with no same-pitch note within 150 ms, during the song) breaks it and lowers accuracy, now (PERFECT + 0.5 GREAT + 0.25 GOOD) / (notes + WRONG). GREAT and GOOD say "EARLY/LATE ±N ms" live; WRONG flashes red. The results screen adds GOOD and Wrong notes; timing feedback counts near misses from 100 to 150 ms.

## Where it lives
`web/src/game/core/judge.ts` (+ tests) · `web/src/game/core/settings.ts` (`GOOD_MS`, `NEAR_MISS_MS`, `GOOD_WEIGHT`) · `web/src/game/core/highway.ts` · `web/src/app/play/page.tsx` · `web/src/game/timing/` · `web/e2e/verify.mjs`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/judging-tiers/web verify --out /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/judging-tiers/20261024T062857Z` pass at 157d2b6 (evidence: /Users/ericzhang/code/hackathons/gator-ai-days-2026/.git/agent-evidence/judging-tiers/20261024T062857Z)

## Gaps
Not verified on the piano: Eric plays twice and records how the tiers felt in findings.md. The 100 ms window and the 0.25 GOOD weight are starting values to tune with timing feedback's data. A key struck twice on one note isn't WRONG (lenient by design, see `specs/decisions/judging-tiers-small-choices.md`). Headless mixed takes matched hand-computed counts exactly (e.g. 29 PERFECT / 11 GOOD / 2 MISS / 1 wrong → 73.84%, max combo 21).
