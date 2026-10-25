# Incident: CI gridlock, where each fix for slow CI took more of a shared runner pool (2026-10-25)

Severity: nothing lost; merges and `main`'s own checks waited in a queue for a shared pool of runners. Times are EDT.
Blameless: each change below was a sensible fix for the problem in front of it. Together they filled the pool.

## What happened

- **Saturday, the setup.** The browser checks moved to GitHub on Saturday afternoon ([#415]): 4 shards at first, then
  8. A PR that touches shared code runs every check. `run-checks.mjs`'s `SHARED` list includes all of `web/src/app/`,
  `web/src/game/core/`, `web/src/contracts/` and `layers.ts`. On Saturday every check took 16.4 to 17.3 minutes on
  `main` ([ci-browser's done note](../../changes/ci-browser.md)).
- **01:09.** `main`'s full run at `a622d4d` has browser shard 2 cut off at the 20-minute job limit. Round-robin
  sharding had put 17.2 minutes of checks on it ([#673], [#674]). A run of every check can't pass, and the rule
  "if `main` is red, merge nothing but the fix" ([AGENTS.md](../../AGENTS.md)) holds every other PR.
- **01:40.** [#673] opens.
- **01:58:40.** [#674] balances the shards by measured seconds. The table predicts 10.4 to 10.5 minutes a shard
  ([the decision](../../specs/decisions/ci-browser-shard-balance.md)). #673 closes.
- **02:20:27.** [#679] raises the shard cap from 8 to 16, for a 7-minute full run. Eric's decision, relayed by the
  planner: "go with 16 to hit the 7 min target, and watch for queueing". A full run now takes 16 runners.
- **02:21.** `main`'s run at `1e5cae1` starts. It finishes green at 02:39:02, the last finished green run on `main`
  at the time of writing.
- **02:35:56.** `main`'s run at `1d0f4cd` starts with 16 browser shards. At about 02:50, 10 of them are still queued,
  waiting since 02:40:31 (`gh run view 40169657308`).
- **02:38:10.** [#692] opens: the ci.yml half of a CI package. It merges at 02:45:26, before [#687], the run-checks
  half, which its own body says to merge first. #687 is still in CI.
- **02:47.** A snapshot of every queued or running workflow (`gh run list` and `gh run view`): 38 browser jobs running
  and 49 queued, across 15 runs. The 16-shard runs include the Étude rename ([#671]) and the second canvas fix
  ([#684]).

## Impact

- **`main` couldn't get its own checks run.** Its newest run sat with most shards queued behind PR runs.
- **Waiting, measured on one run:** #671's 16-shard run waited 153 to 225 seconds per job and took 13.2 minutes
  ([#692]).
- **Merges per hour (GitHub merge times):**

  | Hour (EDT) | Sat 18 | 19 | 20 | 21 | 22 | 23 | Sun 00 | 01 | 02 (to 02:48) |
  |---|---|---|---|---|---|---|---|---|---|
  | PRs merged | 17 | 6 | 9 | 5 | 6 | 12 | 21 | 11 | 17 |

  These count every merge, docs included, so they show the pace, not CI's share of it.
- **Nothing lost.** No commit or PR was lost; the queue drains as runs finish.

## Failure points

1. **Every feature added a browser check, and nothing capped the total.** Each check had a 20-minute job limit, but no
   one owned the sum. It grew to 56 checks and 4,570 seconds by Saturday ([done note](../../changes/ci-browser.md)),
   and about 84 minutes of checks by Sunday ([#679]).
2. **The shared-code rule sent most PRs through every check.** With all of `web/src/app/` on the `SHARED` list, a
   restyle or a rename ran the full suite. The rename to Étude (#671) ran 16 shards.
3. **Each speed-up used more of the same pool.** 4, then 8, then 16 shards made one run shorter, but two 16-shard PRs
   held 32 of about 40 runners ([#692]). The pool's size wasn't measured before the move to 16. At 02:47, 38 browser
   jobs were running at once.
4. **"`main` red, merge nothing" turned one job timeout into a full stop.** From 01:09 to 01:58, a shard limit, not a
   bug, held every PR.
5. **Checks pinned colors and copy.** The restyle broke checks with no bug behind them: an old ink hex in
   `verify-beams` on [#657], and a pinned hint string in `verify-learn`, one of
   the duo-select prep fixes now open ([#695] to [#699]).
6. **The planner endorsed 16 without measuring the pool.** It relayed and endorsed the 16-shard move. When it
   recommended 12 against 16, it flagged the runner pool as unverified but didn't measure it first (the planner's own
   account).

## A sensible rule that became the bottleneck

The merge rule grew one incident at a time, and it lived in a shared agent memory file
(`merge-retest-when-main-moved.md`, outside the repo), not in [AGENTS.md](../../AGENTS.md). Every session in this
project loads that file, and any agent can append to it. It was written or appended to 11 times by at least four
sessions before Eric replaced it, and none of it went through a PR. Each step below was a reasonable answer to the
incident before it. Times are EDT; "note" means the memory file's own words, which GitHub can't confirm.

| When | Incident | Rule added |
|---|---|---|
| Sat 02:49 | [#65] (02:42:30) and [#69] (02:45:54) were each green alone and broke `main` together ([#88]). `main`'s ci failed at 02:46 and was green again by 02:49:26. The note says red for about 10 minutes; GitHub shows about 3. | Retest against current `main` before merging if `main` moved. Gate on `pr_ready.py`'s exit code, never through `tail`. The note says that pipe merged [#58] while not ready; GitHub only shows its merge time (02:14:48). |
| Sat 04:11 | A chained branch delete closed #109 before it merged (the note). | Delete a branch only after the PR shows MERGED. |
| Sat 07:11 | A merge loop merged #237 after a local test failed, because CI was green (the note). | Gate the push and the merge on the local checks' exit codes. |
| Sat 13:40 | Branch protection doesn't require an up-to-date branch. The planner's `train.sh` merged [#509], [#498], [#487], [#501], [#468] and [#491] in 66 seconds (13:37:47 to 13:38:53), untested together. | Check `behind_by`; update the branch when it isn't 0; wait for `main`'s own run to go green before the next merge. |
| Sat 14:04 | `behind_by` 0 livelocked: a ~15-minute browser run, while six workers move `main`. The note says [#511] failed three rounds; GitHub shows eight PR runs on its branch from 13:26 to 14:03, three cancelled, and a merge at 14:05:56. | Merge while behind only if `main`'s new commits don't touch the PR's folders or shared core (the planner's `overlap.sh`). |
| Sat 15:26 | [#476] merged at 14:50:38, before its planned fix [#492]; `main` went red ([#563], open 15:19 to 15:50). [#495] and [#513] merged while #563 was open. The note says a `train.sh` that survived a stop merged #476. | Wait while any `main-red` issue is open. |
| Sat 17:33 | Each `main` push cancels the older run, so "the newest run is green" never came true. | Gate on the newest finished, uncancelled run. |
| Sat ~23:50 | Pushing a `main` merge restarted the ~17-minute PR run, and `main` moved faster, so a PR never landed. | `mergeloop7.sh`: merge `main` locally, retest without pushing, merge with `--match-head-commit`. |
| Sun 01:30 | The newest 10 or more `main` runs were all cancelled; a short look-back found none, and a queue waited about 20 minutes for nothing (the note). | Look back 40 runs. |
| Sun ~03:10 | | Eric replaced it: "merge when the PR's own CI is green and pr_ready exits 0, no retest when main moved, stacks merge back to back". |

**The effect.** By Saturday evening a PR could merge only after its own run and, by turns, `main`'s run, so the
merge loops lined up one at a time behind a 15-to-17-minute browser run. Merges per hour (the table above) ran 5 to 12
from 19:00 to 23:00. That table counts every merge, so it shows the pace, not how much of it the rule cost.

**The planner's part.** `train.sh` and `overlap.sh` were the planner's merge scripts, and it wrote the 13:40, 14:04
and 15:26 rules. The overlap rule was never approved by Eric (the 17:33 note says so).

**Lesson.** A rule kept in agent memory binds every agent, like [AGENTS.md](../../AGENTS.md) does, but it skips the
review AGENTS.md gets (a `contract:` PR that Eric merges). Proposed: a rule that changes how agents merge goes into
AGENTS.md through a `contract:` PR, or it isn't a rule; memory keeps only the incidents behind it.

## Rules from now on

- **Adopted: the CI package ([#692] merged, [#687] in CI).** A PR or a push runs the smoke check only, unless it
  touches `web/e2e/` or `ci.yml`. The full suite runs every 30 minutes and by hand. A red full run opens or comments
  on a `ci-red` issue, which doesn't freeze merges. The shard cap goes back to 8.
- **Proposed: a reviewer session,** waiting for Eric to start it.
- **Pending: the `AGENTS.md` change,** as a `contract:` PR for Eric.

[#58]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/58
[#65]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/65
[#69]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/69
[#88]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/88
[#415]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/415
[#468]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/468
[#476]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/476
[#487]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/487
[#491]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/491
[#492]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/492
[#495]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/495
[#498]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/498
[#501]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/501
[#509]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/509
[#511]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/511
[#513]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/513
[#563]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/563
[#657]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/657
[#671]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/671
[#673]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/673
[#674]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/674
[#679]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/679
[#684]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/684
[#687]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/687
[#692]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/692
[#695]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/695
[#699]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/699
