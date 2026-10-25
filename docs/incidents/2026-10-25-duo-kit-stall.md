# Incident: the Duo kit sat unpushed for over an hour while four features waited on it (2026-10-25)

Severity: no work lost, about an hour and a half of the critical path gone. Times are EDT. Blameless: every agent
here did what its queue said. The queue and the tooling are what failed.

## What happened

- **00:47.** The planner gives eric-agent-3 duo-tokens, then sheet-paper: "duo-tokens is the foundation every screen
  waits on, so keep it small and fast" (eric-agent-3's session record). duo-hud, duo-select, duo-results and
  sheet-paper all list `duo-tokens` in `depends_on` (their specs on `main`).
- **00:49:57.** Plan [#650] merges: the Duo restyle as five features, tokens first.
- **00:51:52.** eric-agent-3 splits the work: a draft `feat(duo-tokens)` PR as the claim, and the repaint as a
  separate `fix:` PR beside it. The kit was built to sit on top of the repaint.
- **00:51:57.** Its only commit to `duo-tokens`, `f1e4686` "feat(duo-tokens): claim", is pushed. Draft [#655]
  opens at 00:52:02. Its GitHub `updatedAt` stays at 00:52:02 from then on.
- **00:52:19.** The repaint's first commit; [#657] opens at 00:52:46.
- **00:54:31.** Plan [#656] merges on Eric's word: duo-tokens also ships a shared Duo kit (panels, brackets,
  buttons, data cells) that select, HUD and results must use.
- **00:54 to 01:08.** The kit is written in the `duo-tokens` worktree and never committed (file times): 534 lines
  in 6 files under `web/src/game/duo-tokens/`, plus 40 lines in 2 decision files (`wc -l`). The last write is at
  01:08:29.
- **01:04 to 01:35.** eric-agent-3 commits to #657: a hype-pink change on Eric's word, a contrast fix after a red CI
  check, and a stale ink color in another feature's check (#657's commits).
- **01:09.** `main`'s first full run with browser shard 2 cut off at the 20-minute job limit starts on `a622d4d`
  (per [#673]). A PR that runs every check can't go green until the fix lands.
- **About 01:40.** Eric asks, through the front desk (eric-asking-agent), for a local Golden spike
  (`video-references/golden-sheet/BRIEF.md`, gitignored).
- **01:40:10.** [#673] opens.
- **01:44:14.** The planner routes Golden to eric-agent-3: "once the Duo kit (#655) has landed", ahead of
  sheet-paper. At 01:44:53 it adds "your order is right", and that nothing merges but the shard fix until #673
  closes, #657 included.
- **01:44:34.** While #657's CI runs, eric-agent-3 starts reading the Golden sheet. `CREDIT.txt` is written at
  01:48:02 and `golden-hard.txt` at 02:00:42 (file times).
- **01:58:40.** The shard fix [#674] merges. #673 closes at 01:58:42. #657 merges `main` into its branch at 01:58:46.
- **02:02.** eric-agent-3 stops transcribing Golden at bar 52. The planner repeats the order: "#657 repaint, then
  #655 kit, then Golden plus audio-track".
- **02:12:10.** #657 merges. #655 still holds only its claim commit.
- **02:19:50.** The planner reorders: "First, duo-tokens #655".
- **02:20:10.** In the worktree, the claim commit is rebased onto `main` (`git reflog`). The kit's files are still
  untracked. Golden's `audio-findings.md` and `beats.json` are written at 02:25:08 and 02:25:55.
- **02:23:05.** Eric: "Has Duo still not been merged?"
- **02:28.** At the time of writing, #655 is still a draft with one claim commit, and the kit is still untracked on
  disk.

## Impact

- **Four features wait on the kit.** All four list `duo-tokens` in `depends_on`. `status.py`'s Blocked list names three:
  duo-hud, duo-results and sheet-paper. duo-select is in flight on a part that doesn't need the kit ([#664]), and its
  other parts still wait. Eric: "this was incredibly important", the thing the whole frontend is gated on.
- **96 minutes and counting** from the claim commit (00:51:57) to the time of writing (02:28) with no kit pushed.
  For about 75 minutes (01:08 to 02:23), 534 lines of finished-looking code sat where no tool and no person looked.
- **Nothing lost.** The files are intact in `~/.worktrees/gator-ai-days-2026/duo-tokens`. They are eric-agent-3's to
  push.

## Failure points

1. **The blocker was queued behind a repaint, and the planner kept that order.** eric-agent-3 stacked the kit on the
   repaint at 00:51, so the kit couldn't land before #657. The planner affirmed the order at 01:44 and 02:02 instead of
   pulling the blocker forward, and only reordered at 02:19.
2. **A spike went to the same worker.** Golden came in through the front desk and the planner routed it to
   eric-agent-3, the owner of the critical-path feature. The route said "once the kit has landed", but the worker
   started Golden during a CI wait while the kit was still unpushed.
3. **WIP was invisible.** `status.py` and the planner read PRs and `main`. Uncommitted files in a worktree show up in
   neither, so the draft looked like an empty claim, not a finished kit waiting to be pushed.
4. **The watchdog wasn't running.** `watchdog.py` would comment on a draft with no push for 45 minutes and close it at
   60, using the PR's `updatedAt`. #655's `updatedAt` stayed at 00:52:02, so a running watchdog would have commented
   at about 01:37. There is no `watchdog.pid` and no watchdog state in `.git`, and no PR in the repo has a "Stale
   claim" comment. Even running, it would have closed the claim, not pushed the kit.
5. **Red CI stretched every wait.** From 01:09 to 01:58, a run of every check couldn't pass, so #657 couldn't land.
   Eric's reading: eric-agent-3 was free while it waited on CI, so it picked up other work.
6. **The kit's scope grew after the claim.** [#656] added the shared kit at 00:54, two minutes after the claim, on top
   of tokens the planner had asked to keep "small and fast" at 00:47.

## Rules from now on

Eric adopted fix 3 ("Yeah, let's do fix 3", relayed by the planner). Fixes 1, 2 and 4 are proposals; Eric decides.

1. **Proposed: push WIP before switching tasks, and at least every 30 minutes,** as hook-passing commits to the
   feature's own branch.
2. **Proposed: a feature with dependents is critical path:** its owner takes nothing else until it's ready, CI
   waits included.
3. **Adopted: the planner's loop flags a draft whose only commit is its claim after 30 minutes,** blockers first (a
   blocker is a slug in `status.py`'s Blocked list). It nudges the worker to push WIP, and relays blockers to
   eric-asking-agent. Since about 02:29, in the planner's 15-minute loop, per the planner. Its first run flagged #655:
   claim-only for 96 minutes, with 3 features waiting.
4. **Proposed: `status.py` leads with "N features waiting on X",** so a blocker is the first thing anyone reads.

[#650]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/650
[#655]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/655
[#656]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/656
[#657]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/657
[#664]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/664
[#673]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/673
[#674]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/674
