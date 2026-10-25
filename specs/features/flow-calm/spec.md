---
name: "Flow calm: \"Take your time\" upright and clear of the waiting note"
depends_on: ["flow-mode", "wait-hint", "duo-tokens"]
owns: ["specs/features/flow-calm/", "changes/flow-calm.md", "specs/decisions/flow-calm-"]
assignee: "eric"
---

# Flow calm

Issue #886, from polish sweep 2. In a Flow take, once a stop runs past the free beats, "Take your time" appears in
heavy italic, centered on the waiting note's column (`flow-mode/index.tsx:175-196`: `drawCalm` puts it at the
note's x, at wait-hint's height, in `italic 800`). The falling note's body passes behind the words and its letter
sits against them. eric-agent-2 parked it behind #778, which makes `drawCalm` upright but doesn't move it.

**The file is held by an open PR** (Files below). Take this spec only once #778 has merged or closed; until then,
switch to the next ready feature.

## The change
1. **Upright.** If #778 merged, `drawCalm` is already upright: keep it. If #778 closed unmerged, drop `italic` here,
   at the same size and weight, as #1131 did for CLEAR and FULL COMBO.
2. **Clear of the note lanes.** The line no longer overlaps the waiting note's column or its letter. #886 suggests
   two places: just above the hit line beside the note, or in the HUD band. Pick the one that stays readable at
   1280×720 and 1920×1080 and doesn't cover another lane's note or wait-hint's name, and log it in
   `specs/decisions/flow-calm-place.md`. Calm ink, never red, its fade and reduced motion as they are now.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/flow-mode/index.tsx`, `flow-mode.test.ts` | flow-mode | **#778** (`fix(flow-mode)`, ready, waits for Eric's go): switch once #778 frees it |

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080, plus reduced motion: `/play?song=twinkle&mode=flow`, Start, then wait on the
  first note until "Take your time" shows. Add one shot on a song with a chord as the waiting note.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
- **(a) Upright:** a test on the calm line's font string finds no `italic`.
- **(b) Clear:** a unit test (a small pure function for the line's box is fine) shows the line's box doesn't
  overlap the waiting notes' columns at 1280×720 and 1920×1080, for a single note and for a chord.
- **(c) Shots and taste v2 scores** in the PR (Design pass above).
- **Unit tests:** `pnpm -C web exec vitest run src/game/flow-mode`.
- `verify-flow.mjs` runs in CI's browser suite; the done note says "not verified locally; covered by main's
  scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/flow-calm-*.md`.
- No new copy, dependency or token.
