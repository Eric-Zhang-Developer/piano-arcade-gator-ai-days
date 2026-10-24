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
- **Two parts.** About ten plugins will have results panels (dynamics, evenness, weak-bars, piano-out today;
  take-graph, records, chord-sync, tempo-curve, take-midi, replay-view next), so they can't all stack under the
  rank (#191 already had to make the screen scroll).
  1. **The ceremony, the first view:** the rank and counts above, then one **featured** panel (`take-graph`, the
     video's results shot), then Retry, Replay on piano (when shown) and Songs. It fits 1280×720 and 1920×1080
     with no scroll. The featured list is a setting in `web/src/game/results-layout/` (`featured: ["take-graph"]`);
     a featured plugin with no panel this time leaves no gap.
  2. **Details, below the fold:** every other panel in a grid of cards (two columns from 1280 px wide, one below),
     each card headed by its plugin's name, in `layers.ts` order. A "Details ↓" cue at the bottom of the first view
     scrolls there; keyboard and screen readers reach every card.
- Every data-testid the verify scripts read stays (the rank, the timing line, `count-extra`, `slot-<plugin id>`).

## Validation
- `verify.py --slug results-layout` passes, and `/sim`'s check still reads `count-extra`.
- With every panel on `main` at the time: the first view has no scroll at 1280×720 and 1920×1080 (the rank's top
  ≥ 0, the buttons visible), and every other panel is reachable below.
- Screenshots of an S rank and a C rank at both sizes, and of the details grid.
- Eric's eye (mark it in the done note): the results read at a glance. `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with taste v2's step 8,
"Look" (that file's last section): 1280×720, 1920×1080 and reduced motion, before and after screenshots in the PR.

## Defaults
- `specs/context/visual-direction.md` wins over any reference frame or skill default. Prefer the smaller option.
- No new dependencies. Never invent data: a value the game doesn't have stays empty or "—".
- Log a choice the spec doesn't make in `specs/decisions/results-layout-*.md`.

Frontend lane: #157. Issue: #154.
