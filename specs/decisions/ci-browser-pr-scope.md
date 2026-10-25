# ci-browser: PRs run the smoke check; the full suite runs every 30 min

**Context.** Eric, 2026-10-25, for the next ~10 hours of shipping: "PRs smoke-only, full suite on main every 30 min plus
on demand, a red scheduled run files an issue instead of freezing merges, and a lenient reviewer session on merged
commits."
- Shared paths used to fan a PR out to every check. The Étude rename (#671, a one-line title change) took 16 shards.
- Two 16-shard PRs held 32 of ~40 runners while main queued 15+ min.
- #671's first 16-shard run waited 153–225 s per job for a runner and took 13.2 min.

**Options.**
- A: every PR and push runs the smoke check; the full suite runs on a 30 min schedule and by hand.
- B: per-folder checks on PRs (the earlier draft of this PR).
- C: full suite on every PR with more shards.

**Choice.** A.
- **PR and push:** `web/e2e/verify.mjs` alone on one shard. A change to `web/e2e/` or `.github/workflows/ci.yml`
  still runs every check, because there the change is the checking itself.
- **Full run:** `schedule` (`*/30 * * * *`) and `workflow_dispatch`, `--all`, at most 8 shards. It has its own
  concurrency group, so it never cancels or queues a push run.
- **No tests are deleted:** every check still runs every 30 min.
- **The trade-off:** main can be red for up to 30 min before anyone sees it, and a PR can pass and still break a
  screen.
- **The guard:** the `ci-red` issue, with the failing checks and the commit range since the last green full run, and
  fixing forward. It isn't `main-red`, so merges don't freeze; AGENTS.md's suspension of the freeze is Eric's own
  `contract:` PR. Before the video or the submission build, a person dispatches a full run and waits for it.

**How to undo.** In `run-checks.mjs`, `selectChecks` can go back to the per-folder pick (git history, #687's first
commit). In ci.yml, drop the `schedule` and `ci-red` job and let a push run `--all` again.
