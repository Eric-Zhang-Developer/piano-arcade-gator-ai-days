## What shipped
Behind `?x=results-landing`, the last note to the rank is one 2.8 s-max cut on one clock: the highway eases to a stop, score and combo fly from the HUD into their cells, the counts tally on the beat grid, the rank stamps 1.08 → 0.97 → 1.0 with a one-frame tint, then the tutor. Any key or click skips to the end without pressing anything. Reduced motion shows the end state first.
## Where it lives
`web/src/game/results-landing/` (timeline, its tests, the seek hook `window.__pianoArcadeLanding`, `verify-landing.mjs`), wired in `web/src/app/play/page.tsx` and `results-layout`. Choices: `specs/decisions/results-landing-choices.md`. Stepped-frame WebMs (not a live capture): `specs/features/results-landing/shots/` (after 98 KB, before 145 KB).
## How to check it
Validation 1 vitest: 5 files, 24 tests pass locally. `node web/src/game/results-landing/verify-landing.mjs --out <dir>`: not verified locally; covered by main's scheduled full run. Not seen by Eric.
## Gaps
No new sound (cue times exported). The two WebMs are different takes (scripted `input=test` vs `bot=perfect`). No reduced-motion screenshot taken by hand; verify-landing saves one. Clear-card's glowing FULL COMBO in the out is off-kit, outside this feature.
