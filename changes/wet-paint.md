## What shipped
`/paint` (Lab → Wet Paint): free play where each note blooms as paint in Scriabin's colors, wet while the pedal (or
Space) is down, dried in place when it lifts. After 60 s or Frame it, the painting hangs in a paper mat with Save PNG
and Again. Optional LED strip lighting. Spike: findings say iterate.
## Where it lives
`web/src/game/x/wet-paint/` (vendored solver, `paint.ts`, `WetPaint.tsx`, `FINDINGS.md`), `web/src/app/paint/`,
`specs/decisions/wet-paint-*.md`, shots in `specs/features/experiments/shots/wet-paint/`.
## How to check it
`pnpm -C web exec vitest run src/game/x/wet-paint` (9 tests). Not verified: `/paint` has no browser check (none added,
to spare the shard budget), and verify.py wasn't run locally (the load rule). Not tried by Eric.
## Gaps
Frame intervals and GPU time are unmeasured (the pane was hidden; CPU frame work p95 0.2 ms). No real MIDI pedal or
DGX tried. No half pedal on laptop keys. Free play only: no chart, score or take. CREDITS entry is #1155, a separate
`docs:` PR.
