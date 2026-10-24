# Incident log

Things that went badly wrong, so agents and people don't repeat them. Newest first. Times are EDT. Only write
facts you can point to: a log line, an issue comment, a command's output. If the cause is unknown, write "unknown".

| When | Incident | Impact | Record |
|---|---|---|---|
| 2026-10-24 02:38–11:45 | Eric playtested a 9-hour-old build: the main checkout's sync job skipped 17 times on a one-line local `.gitignore` edit, and the playtest server ran in a detached worktree nothing syncs | A "works great" live check covered 7 of 82 finished features; Esc "did nothing" though it had been fixed on main since 04:44. Nothing lost | [stale-playtest-build](2026-10-24-stale-playtest-build.md) |

## Adding an incident
One row above. For anything with real cost or a lesson, also add a file `YYYY-MM-DD-<slug>.md` with these sections:
**What happened**, **Impact** (measured), **Failure points**, and **Rules from now on**. Use a `docs:` PR.
