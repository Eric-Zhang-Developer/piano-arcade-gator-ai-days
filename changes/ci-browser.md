## What shipped
A `browser` CI job runs the headless checks on GitHub: `web/e2e/verify.mjs` plus the checks nearest a PR's changes, or every check when shared code changes and on main. A `plan` job sizes the shards at one per 3 checks, 1 to 8 (#555). Each failure gets one rerun (`flaky`). Checks already red on main run as `known red #N` and don't gate. `verify.mjs` also fails on /sim errors. Locally, `verify.py` runs one headless check at a time per machine through `verify.lock`, which is taken over only from a dead holder.
## Where it lives
`web/e2e/run-checks.mjs` and `run-checks.test.mjs` (#413, #433, #449, #452, #466, #504; known-red entries #549, #591); the `plan` and `browser` jobs in `.github/workflows/ci.yml` (#415, #530, #555); `verify.mjs`'s /sim error check (#527); `verify.py`'s lock and `--cmd`, `[verify].command` and tech-stack's Checks (#544); `specs/decisions/ci-browser-check-timeout.md`, `ci-browser-known-red.md`.
## How to check it
- **Any PR:** its `plan` and `browser (n)` jobs.
- **Main, every check (2026-10-24):** 56 checks, 4570 s of check time, over 8 shards. Browser wall time was 16.9, 17.3 and 16.4 min on 0e9be4c, 6cc2b0a and b74399a, with shards 5.6–17.3 min and 0.0 min queue wait by the jobs' timestamps.
- **Ordinary PRs:** 1 shard, 2.3 min (#587) and 1.9 min (#597).
- **#527, with a planted /sim `console.error`:** main `verify: pass`, the PR `verify: FAIL: /sim errors: …`.
## Gaps
- **Phase 2 (one shared server):** not due on what was measured, but measured on 2 ordinary PRs, not the 5 the earlier note asked for. Both took about 2 min, well under the 8 min bar.
- **What's left is every-check runs at about 17 min** (main, and PRs touching shared code: #575 16.2, #527 16.4). They're bounded by the slowest shard. The longest check is verify-sheet at 425 s.
- **Shared-code detection is wide:** a CSS-only `style(veritas)` PR (#607) also ran every check.
- **Flaky reruns:** not counted for these runs. Before #530 it was 0 in 9 PRs.
- **Known red:** verify-toast (#584, fixed by #587; it leaves after 2 main passes, 1 so far) and verify-replay (#552; #593 drops it).
- **Not done:** the two throwaway-PR validations, and a local before/after `verify.py` timing (the spec's 115 s → 75 s is unremeasured).
- **Shards:** up to 8, not the spec's 4.
- Eric's eye: not verified by Eric.
