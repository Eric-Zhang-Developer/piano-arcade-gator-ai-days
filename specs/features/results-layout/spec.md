---
name: "Results layout: rank, tallies and a panel slot"
depends_on: ["ui-tokens", "play-slots"]
owns: ["web/src/game/results-layout/"]
assignee: "eric-agent-1"
---

# Results layout

The results screen composed for the video's results shot. Layout only; `results-tally` and `rank-stamp` animate it.

## Plan
1. The layout component in `web/src/game/results-layout/`.
2. A `fix(core-loop)` PR: `/play`'s results screen renders it.

## Requirements
- The rank, large, in `--pa-gold` and the display face. Beside it, the counts PERFECT, GREAT, GOOD, MISS, WRONG
  and extras, each with its label and token color. Under them: score, accuracy and max combo, then the timing line.
- Then the plugins' results panels (`play-slots`), then Retry, Replay on piano (when shown) and Songs.
- Every data-testid the verify scripts read stays (the rank, the timing line, `count-extra`).
- Fits 1280×720 and 1920×1080 without page scroll when no panel is taller than 240 px.

## Validation
- `verify.py --slug results-layout` passes, and `/sim`'s check still reads `count-extra`.
- Screenshots of an S rank and a C rank at both sizes.
- Eric's eye (mark it in the done note): the results read at a glance. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/results-layout-*.md`.

Frontend lane: #157. Issue: #154.
