---
name: "CI browser checks: the headless checks run on GitHub's machines, not Eric's Mac"
depends_on: ["core-loop"]
owns: ["specs/features/ci-browser/", "changes/ci-browser.md", "web/e2e/run-checks"]
assignee: "eric"
---

# CI browser checks

Eric's Mac (8 cores) runs at load 20–31. Up to 6 agents run headless checks locally, and each check starts its own
`next dev` (or `next build` + `next start`) and its own headless Chromium: `web/e2e/verify.mjs` plus 34
`verify*.mjs` files under `web/src/` (32 in `web/src/game/`, `web/src/operator/verify-operator.mjs`,
`web/src/replay/verify-replay.mjs`). Each copies its own `freePort`, spawn and wait code; there is no shared helper.
CI's only job, `ci` (53 s on the last green main run, its "Project checks" step 36 s), runs no browser at all.

Eric, 2026-10-24: "we should spec out and probably have our standby agent do the GitHub machine one because this is
a very important fix". Then, on the recommendations below: "I'll go with your recommendations. Rigor while
lightening the load on the local machine". The repo is public, so Actions minutes are free.

Issue: #407

## Plan
1. **`feat(ci-browser)`:** `web/e2e/run-checks.mjs` (path-to-check selection, the retry, the sharding) and
   `web/e2e/run-checks.test.mjs` (Vitest, picked up by `pnpm -C web test`). core-loop owns `web/e2e/` but is done,
   so this feature's `owns` entry (the prefix `web/e2e/run-checks`) doesn't overlap an in-flight feature.
2. **`contract:` the `browser` job** in `.github/workflows/ci.yml`. Additive: a new job; `ci` and `issues` are
   unchanged.
3. **`test(core-loop)`:** `web/e2e/verify.mjs` fails on any `pageerror` or `console.error` during its /sim run (the
   one assertion `verify-sim.mjs` has that it lacks; see Local side). It adds a check rather than fixing one: the PR
   shows it passing on `origin/main` and failing with an error thrown on /sim.
4. **`contract:` the local side**, after 3. Not purely additive (it removes a command and changes a Check); Eric
   approved it on 2026-10-24 (quote above), and the PR cites this spec.
5. **`feat(ci-browser)`:** `changes/ci-browser.md` with the numbers from Validation.

## Requirements
- **The job:** `browser` in `ci.yml`, on the same triggers as `ci` (pull_request opened, synchronize, reopened,
  edited; push to main), in parallel with `ci`, covered by the workflow's existing concurrency group.
  `timeout-minutes: 20`. A matrix of 4 shards. Checkout with `fetch-depth: 0` (the selection diffs against the base).
  Same pnpm and Node setup as `ci`, then `pnpm -C web exec playwright install --with-deps chromium`, with
  `~/.cache/ms-playwright` cached under a key on the `playwright` version in `web/pnpm-lock.yaml` (1.64.1 today).
  A shard whose list is empty exits 0 before the Chromium install.
- **Phase 1 edits no check file.** `run-checks.mjs` runs each check as it runs today,
  `node <check> --out <dir>`, and each check keeps spawning its own server: GitHub's CPU, not Eric's. A shard runs
  its checks one at a time.
- **Selection** (`run-checks.mjs --base <ref> --shard <i>/<n> --out <dir>`, or `--all` in place of `--base`):
  - **A pull request and a push to main: the smoke check only,** `web/e2e/verify.mjs` on one shard. The exception is a
    change to the runner or the workflow (`web/e2e/` or `.github/workflows/ci.yml`), which runs every check.
  - **The full suite** (`--all`) runs on a `schedule` at :07, :27 and :47 and by hand (`workflow_dispatch`), over at most
    8 shards. A red full run files or updates one issue labeled `bug` and `ci-red`. It names the failing checks and
    the commits since the last green full run, and it doesn't freeze merges. The decision is
    `ci-browser-pr-scope.md` (Eric, 2026-10-25).
  - "Every check" is `web/e2e/verify.mjs` plus `web/src/**/verify*.mjs`, found at run time, so a new check joins
    without editing the runner.
  - Shards balance by each check's measured seconds (`run-checks.seconds.json`): longest first, onto the lightest
    shard. Every check lands in exactly one shard (decision `ci-browser-shard-balance.md`). `NOT_IN_CI` lists checks
    that smaller checks cover (the whole `verify-sheet.mjs`).
- **Retry, on main only:** on a pull request the first failure fails the shard. On main a failing check reruns once,
  into a fresh `--out` folder. Passes on retry: the shard passes and prints
  `::warning title=flaky::flaky: <check>` (an annotation on the PR). Fails twice: the shard fails. Exit 0 when every
  check passed, 1 otherwise. No check's tolerance, timeout or arguments change; the runner passes only `--out`.
- **Known red** (decision `ci-browser-known-red.md`): a check that is already red on `origin/main` when the job
  finds it gets an issue and an entry in `KNOWN_RED` in `run-checks.mjs`. It still runs and reports `known red #N:
  pass|fail`, but doesn't set the shard's exit code. An entry is removed only after its check passes on 2
  consecutive browser runs that include the fix: some known-red checks pass on a lucky run with no fix merged
  (#430 passed in #415's second run while its fix, #448, was still open), so one green run proves nothing.
- **Output:** one line per check (`<check> pass|flaky|FAIL <seconds> s`) and the shard's wall time, also written to
  `$GITHUB_STEP_SUMMARY` when set. Every check's `--out` folder goes under one evidence folder, uploaded with
  `actions/upload-artifact` when the shard fails (`if: failure()`).
- **Merge gate:** none to add. `pr_ready.py` exits 7 on a failing check run and 8 on a pending one, so each
  `browser (<i>)` check gates the merge; AGENTS.md step 6's `gh pr checks --watch` waits for them. No
  branch-protection change. On main, a red `browser` fails the `ci` workflow run, which is what the watchdog's
  main-red check (`.agents/scripts/watchdog.py`, `check_main`) reads: it goes through the main-red flow, and
  `pr_ready.py` on other PRs doesn't look at it.
- **Local side** (step 4, one `contract:` PR):
  - `[verify].command` in `.agents/config.toml` drops `&& node {worktree}/web/src/game/sim/verify-sim.mjs --out
    {out}/sim`. `verify.mjs` already plays Twinkle through the MIDI path on /sim; measured 75 s for `verify.mjs`
    alone vs 115 s with `verify-sim.mjs`. Every `verify-sim.mjs` assertion keeps running, in `verify.mjs`:

    | `verify-sim.mjs` | `web/e2e/verify.mjs` |
    |---|---|
    | `:73` /sim screen: PERFECT = n, no MISS, no extra | `:141`, the same counts |
    | `:74` 2n key messages in the /sim log | `:143` |
    | `:75` status shows "MIDI: Portable Grand" | `:142` |
    | `:76` no page error or console.error | missing: its error check (`:118`) runs before /sim and counts only `pageerror` and `play-slots:` lines. Step 3 adds it. |

    `verify.mjs` also checks the /sim mean offset within ±4 ms (`:145`) and "Replay on piano" (`:147`); both stay.
  - `verify.py` takes a machine-wide lock before it runs anything: it `mkdir`s `<git common dir>/verify.lock` (the
    directory is the lock) and `rmdir`s it when the command ends, times out or is interrupted, so one local headless
    check runs at a time across all worktrees. It's the same lock as the interim shell loop every worker uses until
    this lands (`until mkdir "$L"; do ...; done; <check>; rmdir "$L"`), so the two never race; `fcntl.flock` on a
    file wouldn't see that loop. A lock whose mtime is over 600 s old is taken over as stale, which assumes no check
    holds it longer: `[verify].timeout` is 300 s. While it waits it prints `verify: waiting for another check`. The
    wait doesn't count toward `[verify].timeout`.
  - `verify.py --slug <x> --cmd "<command>"` runs a feature check through the same lock, timeout, process-group
    cleanup and evidence folder, with the same `{slug}`, `{worktree}` and `{out}` placeholders (chosen over a
    separate `one_at_a_time.py`: one flag on the script that already does all of that).
  - `specs/tech-stack.md`'s Checks: locally, agents run lint, typecheck and the tests near their change
    (`pnpm -C web exec vitest run <paths>`), plus their feature's check once through `verify.py`. The full
    `pnpm -C web test` and `pnpm -C web build` are left to CI's `ci` job.

## Validation
- `pnpm -C web test` (`run-checks.test.mjs`, on the selection as a pure function of changed paths and the check
  list): `web/src/game/notice-toast/index.ts` gives `verify.mjs` and `verify-toast.mjs`; a change only in `specs/`
  gives `verify.mjs` alone; `web/src/game/fever-stage/` gives `verify.mjs` alone; `web/src/operator/` gives
  `verify-operator.mjs`; `web/src/game/core/`, `web/src/game/layers.ts` and `web/e2e/verify.mjs` each give every
  check; over 4 shards every check lands in exactly one, and their union is the whole list. Retry, with tiny fake
  checks (`node -e`): fail-then-pass reports `flaky` and exits 0; fail-twice exits 1.
- A throwaway PR touching only a comment in `web/src/game/notice-toast/` (closed, never merged): `browser` runs
  `verify.mjs` and `verify-toast.mjs` on GitHub and passes. While it runs, `pr_ready.py` exits 8.
- A throwaway branch that breaks Twinkle's judging (closed, never merged): `browser` fails, the artifact holds the
  failure screenshot, and `pr_ready.py` exits 7.
- A push to main runs every check over 4 shards: record each shard's wall time.
- The `browser` job's wall time on 3 real PRs, recorded in the done note. Over 8 min triggers phase 2 (Gaps).
- The flaky count (checks that passed only on retry) over the first 10 PRs after the job lands, in the done note.
- Local `verify.py --slug ci-browser` wall time before and after step 4. Two `verify.py` runs started together: the
  second prints `waiting for another check` and starts after the first ends.
- No check is weakened: the table above, plus `git diff` of steps 1–2 touching no `verify*.mjs`.

## Gaps (accepted)
- **Phase 2, only if the PR job's measured wall time is over 8 min:** a shared `web/e2e/server.mjs` and a one-line
  import per check so a shard starts one server; an unscoped `fix:` PR for done features, `fix(<owner>)` for
  features in flight. Server: `next dev`, which the checks use today; `next build` + `next start` only if every check
  passes on it (`window.__pianoArcade`, `?input=test` and `?bot=` must still work; the operator API routes return 404
  in production, `web/src/app/api/operator/route.ts:8`, so `verify-operator.mjs` needs dev).
- Four checks run `next build` themselves (capture-mode, pause-skin, select-stage, ui-sounds), so a full run builds
  four times. Their `--no-build` flag needs a server phase 1 doesn't share.
- Not in CI: `song-sweep/sweep.mjs` (long), `perf-budget/perf.mjs` (a machine-dependent budget),
  `laptop-octaves/look-octaves.mjs` and `tempo-curve/check-rubato.mjs` (not `verify*` files).
- Linux headless Chromium is not Eric's Mac Chrome: rendering, fonts and timing can differ.
- The DGX piano is never in CI. Eric's piano checks stay manual and batched (`specs/context/findings.md`).

## Defaults
- The job runs on `edited` too (a title fix reruns it), so every check run on the head SHA comes from one workflow run.
- If 4 shards leave one far longer than the others, change `n` or the order in `run-checks.mjs`, not the checks.
- Log choices the spec doesn't make in `specs/decisions/ci-browser-*.md`.
