# Incident log

Things that went badly wrong, so agents and people don't repeat them. Newest first. Times are EDT. Only write
facts you can point to: a log line, an issue comment, a command's output. If the cause is unknown, write "unknown".
What went well goes in the counterpart, the [wins log](../wins.md).

| When | Incident | Impact | Record |
|---|---|---|---|
| 2026-10-25 01:09–02:48+ | CI gridlock: a shard hit the job limit and froze merges, then each speed-up (8, then 16 shards) took more of a shared ~40-runner pool while most PRs ran every check | `main`'s own run sat with 10 of 16 shards queued; 38 browser jobs running and 49 queued at 02:47. Nothing lost | [ci-gridlock](2026-10-25-ci-gridlock.md) |
| 2026-10-25 00:51–02:28+ | The Duo kit (duo-tokens, #655) sat unpushed in a worktree while its owner worked a repaint and a Golden spike behind it, during a red-CI hour; no watchdog was running | Four features wait on the kit (status.py lists duo-hud, duo-results and sheet-paper as blocked); 534 lines invisible to every tool for about 75 min. Nothing lost. Fix 3 adopted: the planner flags claim-only drafts after 30 min | [duo-kit-stall](2026-10-25-duo-kit-stall.md) |
| 2026-10-24 02:38–11:45 | Eric playtested a 9-hour-old build: the main checkout's sync job skipped 17 times on a one-line local `.gitignore` edit, and the playtest server ran in a detached worktree nothing syncs | A "works great" live check covered 7 of 82 finished features; Esc "did nothing" though it had been fixed on main since 04:44. Nothing lost | [stale-playtest-build](2026-10-24-stale-playtest-build.md) |

## Adding an incident
One row above. For anything with real cost or a lesson, also add a file `YYYY-MM-DD-<slug>.md` with these sections:
**What happened**, **Impact** (measured), **Failure points**, and **Rules from now on**. Use a `docs:` PR.
