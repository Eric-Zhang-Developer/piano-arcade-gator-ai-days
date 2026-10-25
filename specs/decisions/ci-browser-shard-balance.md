# ci-browser: shards balanced by each check's seconds

**Context.** #673: browser (2) was cancelled at the job's 20 min on main and on #631, with every check it ran passing.
`shard()` was round-robin by index, so one shard collected adaptive, demo-reset, ghost and sheet-view. By main's
timings that's 17.2 min of checks, plus setup, against a mean of 10.5 min.

**Options.** A: balance by measured seconds (longest first, onto the lightest shard). B: more than 8 shards, which
means more runners and a ci.yml change. C: a longer job timeout, which leaves the next long check to tip it over again.

**Choice.** A. `web/e2e/run-checks.seconds.json` holds each check's seconds from main's full run 40164489468; a check
it doesn't list counts 90 s, about the median. By the table, all 8 shards come out at 10.4–10.5 min. A unit test fails
when any shard of a full run passes 14 min by the table, so a new long check shows up before the job times out.
Refresh the table from a full run's logs when that test fails or a shard nears 20 min.

**How to undo.** Revert the PR; `shard()` goes back to `k % n`.

**No rerun on pull requests (Eric, 2026-10-25).** `runChecks` takes `attempts`. `main()` passes 1 when
`GITHUB_EVENT_NAME` is `pull_request` and 2 otherwise, so main still reruns once before going red. A PR's failing check
then costs its time once, not twice: a check that fails twice at 7 min burned 14. Only 1 of ~520 sampled check runs
passed on a rerun. No ci.yml change: GitHub sets the variable.
