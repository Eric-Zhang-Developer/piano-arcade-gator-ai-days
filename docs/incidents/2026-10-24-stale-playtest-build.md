# Incident: Eric playtested a 9-hour-old build, 233 commits behind main (2026-10-24)

Severity: no harm done, maximum embarrassment. Times are EDT.

## What happened
- **Oct 23, 23:16.** A local `video-references/` folder was created in the main checkout.
- **02:32.** `254891c` (judging-tiers' done note) was committed. That is the build in the
  `~/.worktrees/gator-ai-days-2026/playtest` worktree.
- **About 02:34.** `next dev` started in that `playtest` worktree, a detached checkout. Nothing ever updated it after this.
- **02:36.** The checkout-sync session (started by eric-agent-3) detached the main checkout at `358352d` and
  installed a launchd job to keep it on `origin/main` every 30 minutes. That job skips whenever tracked files have
  changes. The session discarded a local `.gitignore` edit, then suggested re-adding its `/video-references/` line.
- **02:38:17.** `.gitignore` was modified locally to add `/video-references/` (file time). Who made the edit isn't
  recorded.
- **03:05 to 11:05.** The sync job logged `skip: tracked changes` **17 times in a row**, every 30 minutes
  (`~/Library/Logs/gator-main-sync.log`). Nothing outside that log said so.
- **04:44.** Esc-to-pause landed on main (#165).
- **About 11:00.** Eric, after a live check: "It works, and it works great."
- **11:16.** The pause menu's Quit landed on main (#404).
- **About 11:35.** Eric: he keeps hitting Esc in a song and nothing happens.
- **About 11:45.** eric-asking-agent found the main checkout 227 commits behind `origin/main`. Esc doing nothing
  means the build was from before 04:44. Both stale checkouts fit that: the `playtest` worktree (`254891c`) and the
  main checkout (`358352d`). Which one the browser was on isn't recorded. No dev server ran in the main checkout at
  either process check (about 11:10 and 11:46).

## Impact
- **The "live check" covered 7 of the 82 finished features.** The `254891c` build had 7 done notes:
  core-loop, beat-track, timing-feedback, judging-tiers, piano-sim, piano-midi-spike and twinkle-13. The other 75,
  from song-select and the HUD to fever, wait mode and the whole frontend milestone, weren't in it.
- **A real UX complaint about a bug already fixed twice.** Esc pausing was 7 hours old on main, and Quit was about
  20 minutes old.
- **Some lag observations came from that build too,** on a CPU that was overloaded at the same time (load 36–122 on 8
  cores). They don't describe the current game.
- **Nothing was lost.** No code, data or agent work was affected. It cost a playtest and a confident "works great".

## Failure points
1. **The sync job skips silently.** A skip writes one log line and nothing else. 17 skips over 8.5 hours went
   unnoticed.
2. **A local-only ignore made the job skip.** A line for a local folder went into the tracked `.gitignore` instead of
   `.git/info/exclude`, so the job's "no tracked changes" safety check tripped every run.
3. **The playtest server was in a worktree that nothing syncs.** A `next dev` in a detached worktree keeps serving
   that commit forever. The sync job only covers the main checkout.
4. **The game doesn't say which build it is.** Nothing on screen shows the commit or its age, so a 233-commit-old
   build looks like the current one.
5. **Agents can read the stale checkout too.** eric-asking-agent's first `status.py` run read the main checkout at
   `358352d` and reported the wrong ready list. It noticed and re-ran from a detached `origin/main` worktree. It then
   told Eric he was playing the main checkout, when a running dev server only existed in `playtest`.

## Rules from now on
- **Local-only ignores go in `.git/info/exclude`,** never in the tracked `.gitignore`.
- **The sync job notifies on every skip** (a macOS notification naming the reason), not only in its log.
- **Before a playtest whose results get written down:** `git rev-list --count HEAD..origin/main` in the checkout
  being served must print `0`, and the dev server must have started after that. Otherwise, pull and restart first.
- **Agents read state from a fresh detached `origin/main` worktree,** never from the main checkout's HEAD.
- **Proposal (planner):** a build stamp, showing the short commit and its age, in a corner of the start screen during
  development, so a stale build is obvious at a glance.
