---
name: "Sheet review: from the results, open the score with this take's judgments already colored"
depends_on: ["sheet-view", "results-layout"]
owns: ["web/src/game/sheet-review/"]
assignee: "eric"
---

# Sheet review

The sheet window (`/sheet`, sheet-view) only follows a take live. At judging, a player who just finished wants to
see which notes they missed on the score, after the take, without having had the window open.

Issue: #367

## Plan
Four small PRs, in this order:
1. `feat(sheet-review)`: `web/src/game/sheet-review/`: `review.ts` (pure: a take's review from its chart and
   results; save and load over one localStorage key), a plugin whose results panel is the button, tests. One line in
   `layers.ts`, after `sheetView()`. No done note.
2. `fix(sheet-view)`: `SheetView.tsx` reads `?review=1`: it loads the stored review and shows it, as below.
3. `fix(results-layout)` adds `"sheet-review"` to `actions`, so the button joins Retry and Songs.
4. `feat(sheet-review)`: `verify-review.mjs`, screenshots and the done note.

Stored, not sent: a BroadcastChannel message is lost when no sheet window is open yet, and the button opens it.

## Requirements
- **The button** "Review on sheet ↗" on every results screen (plain, practice and wait mode). Its click saves
  `pianoArcade.sheetReview` = `{ chart, judgments: { [noteId]: Judgment }, startedAt, accuracy }` (the chart as
  played, `results.judgments`, `take.startedAt`), then opens `/sheet?song=<song>&review=1` with sheet-view's window
  name `pianoArcadeSheet` and `"popup"`, so an open sheet window is reused. `data-capture-hide`, as "Sheet music ↗"
  is: the score is never on the arcade screen (decision 001).
- **The review** (`/sheet?review=1`): the stored chart rendered as live takes are (in its whole song's key,
  `songFor`), every notehead painted with its judgment's HUD color at once, no cursor. The header's note reads
  `Review · take at 14:02 · 92.4%` (local time of `startedAt`, accuracy to one decimal) and the legend shows each
  judgment's count. No review stored, or one that's corrupt: the plain score and `No take to review`.
- A live take on `/play` still replaces what the sheet shows (the latest take wins), as today.
- Test hook: sheet-view's `__pianoArcadeSheet` gains `review: boolean`; its `colored` counts already exist.

## Validation
- `pnpm -C web test`: a review of a Twinkle take keeps every note's judgment; load returns `null` for corrupt JSON
  and for a throwing `localStorage`; the header line formats `startedAt` and accuracy.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/sheet-review/verify-review.mjs --out <dir>`: prints `verify-review: pass` and exits 0, or
  names each failed step and exits 1.
  1. `/play?song=twinkle&beat=off&bot=rank-c` -> results; click "Review on sheet ↗" -> a popup on
     `/sheet?song=twinkle&review=1` reaches `data-sheet="ready"`; `__pianoArcadeSheet.colored` equals the results'
     PERFECT, GREAT, GOOD and MISS counts (MISS above 0), `review` is true and `cursorMs` is `null`.
  2. Retry with `bot=perfect`, click again -> the same popup now shows MISS 0: the stored review is this take's,
     so a stale one fails the check.
  3. Under `?capture=1` the button isn't visible.
  4. Screenshots of the actions row and the review at 1280×720 and 1920×1080, kept in `<dir>`.
- `verify.py --slug sheet-review` passes.
- On the piano (Eric; mark it in the done note): play Ode to Joy, open the review on a second monitor; are the
  MISS-colored heads the notes you missed?

## How it's built and checked
Follow `specs/context/visual-direction.md` and sheet-view's look (`specs/decisions/sheet-view-look.md`). Build
with the `frontend-design` skill. Review with taste v2's step 8, "Look": 1280×720 and 1920×1080, plus reduced
motion. Before and after screenshots of the results' actions and `/sheet` go in the PR.

## Defaults
- One review is stored: the latest click's. Same browser only, as sheet-view's channel.
- Pedal marks aren't carried: pedal-lamp posts them to the live sheet; a later `fix(sheet-review)` can add them.
- `fix(results-layout)` conflicts with practice-report's one-line change to the same settings: rebase, keep both.
- Log choices the spec doesn't make in `specs/decisions/sheet-review-*.md`.
