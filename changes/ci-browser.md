## What shipped
DRAFT (claim #427; finished last). A `browser` CI job runs the headless checks on GitHub over 8 shards: `web/e2e/verify.mjs` plus the checks nearest a PR's changes, or every check when shared code changes and on main. One rerun per failure (`flaky`); checks already red on main are listed with their issues and don't gate (`KNOWN_RED`).
## Where it lives
`web/e2e/run-checks.mjs` and `run-checks.test.mjs` (#413, #433, #449, #452, #466); the job in `.github/workflows/ci.yml` (#415); `specs/decisions/ci-browser-check-timeout.md`, `ci-browser-known-red.md`.
## How to check it
All-checks runs on #415: 4 shards, 35 checks: 516/824/1125/576 s; 8 shards, 39 checks: jobs 2m42s–12m47s (sheet-view 429 s sets the slowest). Ordinary-PR job time and the flaky count over 10 PRs: not measured yet.
## Gaps
Pending: test(core-loop), the local side (verify.py lock, `--cmd`, `[verify].command`), the throwaway-PR validations, 3 real PRs' times.
