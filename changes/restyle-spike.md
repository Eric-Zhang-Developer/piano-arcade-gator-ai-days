## What shipped
The restyle spike's machinery and four local restyles: a melody lock (`melody`, `lockProblems`) that code checks,
the session's brief, and the script that restyled Twinkle (trap), Ode to Joy (waltz), Minuet in G (ragtime) and Für
Elise (lullaby). All four pass the lock and the library test. The charts stay in the worktree's
`web/public/songs/local/`, never committed. The drum patterns are #578 (`fix(beat-track)`).
## Where it lives
`web/src/game/restyle/` (the lock and its test) · `spikes/restyle/` (`prompt.md`, `restyle.py`, `FINDINGS.md`) ·
`specs/decisions/restyle-spike-one-script.md`
## How to check it
`python3 spikes/restyle/restyle.py <id>` for each id, then `pnpm -C web exec vitest run src/game/restyle
src/game/songs/library.test.ts`: 34 passed at 21:13 UTC, the four restyles included. CI has no restyles, so it runs
the synthetic cases only. verify.py: see the PR.
## Gaps
- **Eric hasn't listened yet (the spike's question):** FINDINGS.md says "listen pending".
- Restyles are judged with `hands=R` only, until #506 is decided. Tokens per run weren't measured.
