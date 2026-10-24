---
name: "Pill match: ghost outlines and note labels take their size from the note pills"
depends_on: ["ghost", "note-labels", "note-pills"]
owns: []
assignee: "eric"
---

# Pill match

This closes two gaps the done notes left after note-pills. Ghost's outlines are square rectangles while notes are
rounded pills (`changes/ghost.md`). note-labels sizes black-key labels to 84% of the key while black-key pills are
about 78% (`changes/note-pills.md`), so a label can be wider than its pill. Both take their geometry from note-pills'
`pillRect`.

Issue: #262

## Plan
Three PRs: a `fix(ghost)` (step 1), a `fix(note-labels)` (step 2), then `feat(pill-match)` with the screenshots and
the done note. `owns` stays empty: a spec that isn't done holds its `owns` exclusively (`in_flight` in
`.agents/scripts/lib.py`), even in backlog, and laptop-octaves needs its own `fix(note-labels)` meanwhile.
1. **Ghost:** a pure `ghostOutline(key, isBlack, top, bottom)` in `web/src/game/ghost/ghost.ts` returns the pill's x
   and width from `pillRect`, and the highway's corner radius (`bar` in `core/highway.ts`: the pill's radius, capped
   at a third of the width and half the height). `draw` in `ghost/index.ts` strokes it with `roundRect`. Ghost stays
   off under `?perspective`, so a flat rounded rect matches the highway's pill. `isBlack` comes from `core/highway.ts`.
2. **Labels:** a pure `noteLane(key, isBlack)` in `web/src/game/note-labels/labels.ts` returns
   `pillRect(key, isBlack).width`. It replaces `k.width * 0.84` in `drawNotes` (`note-labels/index.ts`), and core's
   `isBlack` replaces the copied pitch-class list in `drawKeys`.
3. Before and after screenshots, and the done note, which records both gaps as closed. `changes/ghost.md` and
   `changes/note-pills.md` belong to their features and stay as they are.

## Requirements
- **Ghost:** each hit's outline has the x, width and corner radius of the pill the highway draws for that pitch at
  the same zoom, on white and black keys. Its top and bottom stay as today (when you played it). Dash, alpha and
  line width come from `ghostSettings` as today. It's never filled. Extras' ticks don't change.
- **Labels:** a falling note's label is sized and fitted to its pill's width. A black-key label is sized from about
  78% of the key (0.84 × 0.56 / 0.6), and no label is wider than its pill. `minLaneForNotesPx` (14 px) is measured on
  the pill, so on wide charts a few more black-key labels hide. That's expected. Key labels don't change.
- No change to core's highway or to note-pills.

## Validation
- `pnpm -C web test`:
  - `ghostOutline` gives `pillRect`'s x and width on a white key and on a black key, and a radius no larger than the
    highway's corner rule. Ghost's draw, with a fake context, calls `roundRect` with those numbers.
  - `noteLane` is about 0.784 × the key on a black key and 0.84 × the key on a white key. With a fake context, a
    black-key label that fits 84% of the key but not its pill hides (today it shows).
  - ghost's and note-labels' existing tests pass.
- `verify.py --slug pill-match` passes. So do `node web/src/game/ghost/verify-ghost.mjs --out <dir>` and
  `node web/src/game/note-labels/verify-labels.mjs --out <dir>`, unchanged.
- Headless Chrome at 1920×1080 (Twinkle has no black keys, so use Für Elise), before and after screenshots in the PR:
  1. `/play?song=fur-elise&from=1&to=2&passes=1&bot=late`, then Retry -> the outlines are rounded and sit on the
     pills, D♯5 included.
  2. `/play?song=fur-elise&labels=notes` -> each D♯ label sits inside its pill.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's
(`design-taste-frontend`) step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots go in
the PR.

## Defaults
- Match the highway exactly. If the pill geometry changes later, both follow it through `pillRect`.
- Another feature's `fix(ghost)` or `fix(note-labels)` PR open at the same time: rebase on whichever lands first.
