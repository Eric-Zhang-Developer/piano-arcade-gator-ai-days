---
name: "Build stamp: the short commit and its age in a corner of /, so a stale build is obvious"
depends_on: ["song-select", "capture-mode", "ui-tokens"]
owns: ["specs/features/build-stamp/", "changes/build-stamp.md", "web/src/game/build-stamp/", "specs/decisions/build-stamp-"]
assignee: "eric"
---

# Build stamp

On 2026-10-24 Eric playtested a build 9 hours old (233 commits behind main) for most of the morning without knowing
it. A `next dev` server in a detached worktree kept serving its commit, and nothing on screen said which build it
was. His "works great" covered 7 of 82 finished features, and he reported Esc doing nothing, which main had fixed 7
hours earlier. The incident's failure point 4: "The game doesn't say which build it is." This feature fixes that one.

Issue: #422

## Plan
1. **`feat(build-stamp)`:** `web/src/game/build-stamp/`: the component, its pure text function with
   `build-stamp.test.ts`, and `verify-stamp.mjs`. Nothing mounts it yet.
2. **`fix(song-select)`:** song-select owns `web/src/app/page.tsx` (done). One import and `<BuildStamp />` next to
   `<OptionsDrawer />`.
3. **`feat(build-stamp)`:** the screenshots in `specs/features/build-stamp/` and `changes/build-stamp.md`.

`web/next.config.ts` doesn't change (see How the commit is read). No feature owns it; if a later change needs it, that
is an unscoped `fix:` PR. `web/package.json` is frozen: no new dependency.

## How the commit is read
- **On the server, from git, at render.** `<BuildStamp />` is a server component that runs
  `git log -1 --format=%h%n%cI` (`execFileSync`, cwd `web/`, timeout 2 s, stderr ignored) for the short SHA and the
  committer time. `%h` abbreviates the same way as `git rev-parse --short HEAD`.
- **Under `next dev`:** server components render on every request, so a reload after `git pull` (or any new commit
  in that checkout) shows the new commit, and `next dev` hot-reloads the pulled files too. A long-running dev server
  shows the commit of what it serves, not the commit it started on.
- **Under `next build`:** `/` is prerendered, so git runs once at build time and the stamp is the build's commit.
- **Why not next.config's `env`:** it is read once when the server starts, so a dev server would keep showing its
  start commit after a pull while serving newer code. A request-time API route works too, but adds a fetch and a
  route for what a server component already does.
- **No git** (a tarball build, git missing, not a repo, the command fails or times out): the stamp reads
  `unknown build`, in ink-dim, never amber.
- **No network.** Nothing compares with origin (`offline-ready` stays true). The age alone is the signal.

## Requirements
- **Where:** `/` only, fixed in the bottom-right corner, 12 px from both edges, above the page's content in
  z-order and below the options drawer when it is open. Body font (`system-ui`), 12 px at 1280×720 and 14 px at
  1920×1080 (`clamp(12px, 1.3vh, 14px)` or the like), `--pa-ink-dim`, no panel, no border, no animation. It must not
  overlap a song card or the focused song at 1280×720 or 1920×1080; if the bottom-right does, take the top-right and
  say so in the done note.
- **Text:** `<sha> · <age>`, e.g. `a1b2c3d · 9 h old`. Age, from the committer time to now, rounded down:
  under 60 min `N min old` (`0 min old` included); under 48 h `N h old`; else `N d old`. A commit time in the future
  (clock skew) counts as 0.
- **Stale:** older than 2 h (strictly more than 120 min): the text turns `--pa-sun` and gains ` · behind main?`, e.g.
  `a1b2c3d · 9 h old · behind main?`. Color is never alone: the words say it too. **2 h is a starting value**, one
  named constant: a busy night lands a commit on main every few minutes, so 2 h without one most likely means a stale
  checkout. Change it if it fires on a fresh build.
- **The age is computed in the browser**, after mount and again every 60 s, by a small client child that takes the
  SHA and the ISO time as props. The server renders the SHA alone, so a prerendered page never shows its build-time
  age and there is no hydration mismatch.
- **One pure function** does the text: `stampText(sha: string | null, committedAt: string | null, now: number)`
  returns `{ text, stale }`. `null` input gives `{ text: "unknown build", stale: false }`.
- **Capture:** the root element has `data-capture-hide`, so `?capture=1` hides it (capture-mode's rule).
- **Accessibility:** a plain text node (screen readers read it); `title` carries the full committer time.
- **Not on /play.** /play is a client component, so it can't run git; the stamp there would need next.config `env`
  (the dev start commit, wrong after a pull) or a route. `/` is where every session starts. Gaps.

## Validation
- `pnpm -C web exec vitest run src/game/build-stamp`: `stampText` gives `0 min old` at 0 and 59 s, `59 min old` at
  59 min, `1 h old` at 60 min, `2 h old` and not stale at exactly 120 min, stale with `behind main?` at 120 min 1 s,
  `47 h old` at 47 h, `2 d old` at 48 h, `0 min old` for a time 5 min in the future, and `unknown build`, not stale,
  for a null SHA or time.
- `node web/src/game/build-stamp/verify-stamp.mjs --out <dir>` (one run, its own `next dev` like the other
  `verify*.mjs` checks): headless `/` shows the text of `git rev-parse --short HEAD` in the stamp; `/?capture=1`
  hides it (not visible after hydration); screenshots of `/` at 1280×720 and 1920×1080, kept in
  `specs/features/build-stamp/`. ci-browser's runner picks the file up by its name.
- **The dev claim,** once by hand, in a throwaway worktree: start `next dev`, load `/`, `git commit --allow-empty -m
  x`, reload: the stamp shows the new SHA without a restart. Record both SHAs in the done note.
- **The build claim,** once: `pnpm -C web build && pnpm -C web start`: the stamp shows the built commit.
- **Stale look,** once: a throwaway worktree on a commit older than 2 h (`git worktree add <dir> <old sha>`), its
  `/` at 1920×1080: amber with `behind main?`. Keep the screenshot.
- `verify.py --slug build-stamp` passes.
- Review per `visual-direction.md` (taste v2's "Look" only): the stamp doesn't draw the eye in the 1920×1080 frame.

## Gaps (accepted)
- Not on /play's start screen (above). Add it later through a route if a playtest starts on /play.
- A dirty working tree isn't shown: the stamp is the commit, not the files.
- The production deploy may have no git at build time and read `unknown build`. Check the deployed `/` once and record
  what it shows; that's fine, the stale-build problem is local.
- The age can't tell "behind main" from "main has been quiet for 2 h". It says `behind main?` with a question mark
  on purpose.

## Defaults
- If the bottom-right overlaps something at either size, use the top-right (above).
- Log choices the spec doesn't make in `specs/decisions/build-stamp-*.md`.
