---
name: "Sheet on paper: notation sits on a lit paper panel inside the dark UI"
depends_on: ["duo-tokens", "sheet-view", "sheet-review"]
owns: ["specs/features/sheet-paper/", "changes/sheet-paper.md", "web/src/game/sheet-paper/", "specs/decisions/sheet-paper-"]
assignee: "eric"
---

# Sheet on paper

Issue #649. In `specs/context/visual-direction.md`, sheet music is "a lit music stand on a dark stage": wherever music
is read, the score sits on a warm off-white paper panel with black ink and sharp corners. It's never inverted. Eric, a
pianist, finds dark-mode notation uneasy to read.

## What exists (origin/main, 2026-10-25)
- **`/sheet` (sheet-view)** renders on `var(--pa-bg)` (`sheet-view.module.css:4,28`). OSMD gets
  `defaultColorMusic: ink`, and the cursor is cyan at 0.35 alpha (`SheetView.tsx:191-193`). There's no CSS filter.
- **Judged noteheads** are painted with `setAttribute("fill"/"stroke")` (`follow.ts:110-111`) in the HUD's
  `judgmentColors` (`SheetView.tsx:23`, :115, and the legend at :297).
- **`/sheet?review=1`** (sheet-review) uses the same `SheetView`.
- The results have no score strip today.

## Plan
1. **`fix(sheet-view)`:**
   - the score sits on a paper panel (`--pa-paper` background, `--pa-paper-ink` notation, 1px hairline, zero radius)
     centered in the dark page;
   - the page chrome (title, legend, buttons) stays dark Duo;
   - the cursor is `--pa-primary` at low alpha.
2. **`fix(sheet-view)`, judgment colors on paper:** gold and grey wash out on off-white, so the judged noteheads use
   **darker variants of the same hues**, picked for contrast against `--pa-paper` (WCAG 3:1 at least) and logged in
   `specs/decisions/sheet-paper-colors.md`. The legend matches. Right and left hand, where shown, use the Duo blue and
   purple, darkened the same way if needed.
3. **`feat(sheet-paper)`:** `verify-paper.mjs`, the screenshots, the done note.

## Requirements
- **No inversion anywhere:** no `filter: invert`, and no light-on-dark notation on any page where notation is read.
- **The paper hex:** from duo-tokens (`specs/decisions/duo-tokens-paper.md`). Agree on it with that worker. Don't pick
  a second one.
- **Song picker thumbnails are exempt** (duo-select's piano roll).
- **A future results score strip** (none today) must use the same paper panel. Note it in the done note. Don't build it here.

## Validation
1. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug sheet-paper --worktree . --cmd "node {worktree}/web/src/game/sheet-paper/verify-paper.mjs --out {out}"`.
   It prints `verify-paper: pass` or names each failed step:
   1. `/sheet?song=twinkle`: the score's container has `--pa-paper`'s background, a staff line's computed stroke is
      the paper ink, and no element on the page has a `filter`.
   2. `/sheet?review=1` with a stored take: every judged notehead's fill has at least 3:1 contrast against the paper
      (computed in the page).
   3. Screenshots `sheet.png` and `review.png` at 1280×720 and 1920×1080.
2. Eric reads a page of Für Elise on it. Is it comfortable? Mark it in the done note.

## Defaults
- **Last in the restyle.** Cut by Sunday noon (2026-10-25 12:00 ET).
- The sheet player's further details are Eric's or Andres's to refine (visual-direction.md), not this spec's.
- Log any choice this spec doesn't make in `specs/decisions/sheet-paper-*.md`.
