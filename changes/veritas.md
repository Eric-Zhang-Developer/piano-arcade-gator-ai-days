## What shipped
`/veritas`: five test players (Golden, Rusher, Jitter, Fumbler, Chord Roller) plant mistakes in real library songs, and the judge /play uses, run in the browser, marks exactly those ("2 planted, 2 found, 0 false alarms"). Below it, a dashboard of main's last CI run, frozen by `freeze.mjs`; anything CI didn't keep reads `unknown`.
## Where it lives
`web/src/veritas/` (players.ts, hero.tsx, dashboard.tsx, freeze.mjs, verify-veritas.mjs, tests), `web/src/app/veritas/`, `web/public/veritas/snapshot.json`, screenshots in `specs/features/veritas/`.
## How to check it
verify: `pnpm -C web verify && verify-sim.mjs` pass at 25a6741 (evidence: .git/agent-evidence/veritas/20261024T234309Z). `node web/src/veritas/verify-veritas.mjs --out <dir>` 14/14. `vitest run src/veritas`: 74 passed, 1 expected fail; every player on all 10 committed charts finds exactly what it planted, with 0 false alarms. The snapshot is run 40142731333 (8337a3b, success), and its unit totals equal the ci job's "Tests 764 passed | 1 skipped (765)".
## Gaps
Rusher isn't flagged: the judge has no rushing measure (#545, default C, the page shows the gap). Per-suite results, browser checks and screenshots read `unknown` until #539 keeps them for green runs; refreeze after it lands and before the video. Chord Roller's rings are dense on the prelude, left for veritas-polish (CSS only). /how's link to /veritas waits for #460.
