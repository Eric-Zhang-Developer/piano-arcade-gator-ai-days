# ci-browser: a pull request runs only its own folders' checks

**Context.** Eric, 2026-10-25: "Why do we need to run the full fucking browser test? … I can test stuff manually."
Shared paths (core, contracts, `app/`, `layers.ts`, `package.json`, …) used to fan a PR out to every check. The Étude
rename (#671, a one-line title change in `app/layout.tsx`) took 16 shards. Two PRs at 16 shards each held 32 of about
40 runners, and main queued 15+ min. #671's first 16-shard run waited 153–225 s per job and took 13.2 min end to end.

**Options.** A: PRs run `verify.mjs` plus the checks of the folders they touch, and only the runner or the workflow
(`web/e2e/`, `.github/workflows/ci.yml`) fans out. B: keep the fan-out and shrink each check. C: keep it and add
runners.

**Choice.** A, with main's push still running every check, now over 8 shards again (a `contract:` PR to ci.yml).
- **The trade-off:** a PR can pass and still break main, because a change to core or `app/` no longer runs the checks
  of the screens that use it.
- **The guard:** main's full run on every push, and AGENTS.md's red-main rule (merge nothing but the fix; anyone may
  revert after 20 min).
- **Example:** #671 now picks `verify.mjs`, `verify-phone.mjs` and `verify-veritas.mjs`, one shard.

**How to undo.** Put the shared paths back in `FULL_RUN` in `web/e2e/run-checks.mjs`.
