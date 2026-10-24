# ci-browser: checks already red on main run but don't gate, each with its issue

**Context.** The `browser` job's first run (#415, every check over 4 shards) found checks that fail on `origin/main`
itself: `verify-preview.mjs` failed both its run and its rerun, the same way each time. These failures are
regressions that landed before any browser check ran in CI, not flakes and not the job's doing. A gating job can't
land while main is red under it, and main can't go green until each owner fixes its check.

**Options.** (A) Hold the job until every owner fixes theirs: nothing is gated in the meantime, so new regressions
keep landing. (B) Land the job with `continue-on-error`: nothing is gated until someone flips it. (C) A known-red list
in `run-checks.mjs`: those checks run and are reported, but don't fail the shard; every other check gates now.

**Choice.** C (eric-planning-agent, 2026-10-24). `KNOWN_RED` maps each check to its issue. A known-red check runs as
usual (with its rerun) and prints `known red #N: pass|fail` in the log, an annotation and the step summary. It never
sets the shard's exit code. The list only shrinks: the PR that fixes a check removes its entry. `run-checks.test.mjs`
fails if an entry has no issue number or names a file that doesn't exist.

**How to undo.** Empty `KNOWN_RED` (every check gates), or delete it and its three uses in `run-checks.mjs`.
