---
name: "Landing skip seams: a skip lands every part of the results, eats only its own click, and a late pause can't flash"
depends_on: ["results-landing", "record-moment", "results-polish"]
owns: ["specs/features/landing-skip-seams/", "changes/landing-skip-seams.md", "specs/decisions/landing-skip-seams-"]
assignee: "eric"
---

# Landing skip seams

Issues #1334-#1336, from a post-merge bug review of the features merged on Oct 25. All three are in
results-landing's cut, the 3 s from the last note to the rank: a skip that leaves NEW RECORD behind, a skip that
eats the next real click, and a pause in the out that flashes and vanishes. One PR: the results as they land.

## The changes
1. **#1334 skip reaches the end state:** on a skip, every finite animation under `[data-testid="record-moment"]` is
   finished (`getAnimations({subtree: true})`, skipping infinite ones such as the cursor blink, where `finish()`
   throws), so NEW RECORD and the initials show at once. The stamp's drumroll and hit are cancelled on skip, or the
   done note says that gap is accepted.
2. **#1335 only a primary press swallows a click:** `swallowClick` is set only for `e.button === 0` and cleared on
   `pointercancel`.
3. **#1336 no pause in the out:** once the landing has started, a pause is ignored and the pause button is hidden for
   the out (the smaller change; every note is judged by T0), or the pause holds the landing clock until Resume. Log
   the choice in `specs/decisions/landing-skip-seams-pause.md`.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/results-landing/index.ts` | results-landing | free; frozen-clock-fades imports from it read-only |
| `web/src/game/results-landing/verify-landing.mjs` | results-landing | **#1300** (full-run-reds): switch once #1300 frees it |
| `web/src/game/sound/index.ts` (only to cancel the stamp cues) | juice-sound | **#600** (draft): prefer cancelling from results-landing; else switch once #600 frees it |
| `web/src/app/play/page.tsx` (#1336) | judging-tiers | **#600**: switch once #600 frees it, unless the pause can be refused from `results-landing/index.ts` |

## Design pass (AGENTS.md, Visible changes)
Invoke `frontend-design`, then `design-taste-frontend` (taste v2). Shots at 1280×720 and 1920×1080, plus reduced
motion, from your own dev server in the in-app browser: a record take skipped at mount + 50 ms, before and after,
and the out with the pause button gone (if that's the route taken). Score against `references/critique.md`, fix the
top three, at most three rounds.

## Validation
- **(a)** Each issue's Done-when as a `verify-landing.mjs` step:
  - #1334 on a record take, click at mount + 50 ms; on the next frame `new-record` and `initials-entry` have
    computed opacity 1.
  - #1335 `pointerdown {button: 2}` mid-cut, then click Retry: a new take starts.
  - #1336 press Esc right after T0: the pause menu never opens (or the results haven't mounted).
  These change a browser check, so each fix reproduces its failure first: run that one check locally under
  `verify.lock` on origin/main (red) and on the branch (green), and put both lines in the PR.
- **(b)** A unit test for the pure parts (the button filter, the pause refusal) beside `timeline.test.ts`.
- **(c)** `pnpm -C web exec vitest run src/game/results-landing src/game/record-moment` passes, plus the Checks in
  `specs/tech-stack.md`.

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/landing-skip-seams-*.md`.
- No new dependency, no new token, no change to `web/src/contracts/`.
