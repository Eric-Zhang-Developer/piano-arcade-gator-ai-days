# ci-browser: the runner stops a check after 8 minutes

**Context.** The spec gives the `browser` job `timeout-minutes: 20` and says no check's own timeout changes. A check
that hangs (a server that never comes up, a selector that never appears without its own timeout) would run until the
job is cancelled. A cancelled job skips `if: failure()` steps, so the evidence artifact would never upload.

**Options.** (A) No runner timeout: the job's 20 min is the only one. (B) The runner kills a check's process group
after a fixed time and counts that run as a failure, so the rerun, the FAIL line and the artifact still happen.

**Choice.** B, at 8 minutes per run (`CHECK_TIMEOUT_MS` in `web/e2e/run-checks.mjs`). That's above every check's
own waits (the longest is 120 s for a server plus a song) and above the four checks that run `next build` first,
and short enough for one hung check's rerun to finish inside 20 min. It passes no argument to a check and changes
none of its timeouts or tolerances.

**How to undo.** Raise `CHECK_TIMEOUT_MS`, or delete the timer in `runOnce`.
