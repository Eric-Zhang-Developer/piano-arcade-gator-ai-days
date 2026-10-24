---
name: "Select to stage: the focused jacket scales into the stage card"
depends_on: ["stage-card", "select-layout"]
owns: ["web/src/game/select-to-stage/"]
assignee: "eric"
---

# Select to stage

The video's first cut, music select to stage card, as one move: the jacket you chose becomes the card's jacket.

## What the platform gives
Next 16.4.3 with React 19.3 supports view transitions with no config (`<ViewTransition>`;
`web/node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`). A shared-name morph only pairs when the
destination renders in the navigation's own commit, and `/play` loads its chart in an effect
(`web/src/app/play/page.tsx`), so the stage card renders later and `<ViewTransition name>` alone won't pair. So
this feature calls the browser's `document.startViewTransition` itself. Next's CSS modules are `pure` (every selector
needs a local class; `next/dist/build/webpack/config/blocks/css/loaders/modules.js`), so a bare
`::view-transition-group(stage-jacket)` rule won't compile in one. Set the timing from JS instead: on the
transition's `ready`, `updateTiming` each `document.getAnimations()` entry whose `pseudoElement` is a view
transition's. No CSS, and no stylesheet from `/` that must outlive the navigation.

## Plan
1. **A `fix(stage-card)` PR:** `.jacket` in `stage-card.module.css` gets `view-transition-name: stage-jacket`. One line.
2. **A `fix(select-layout)` PR:** `goToStage(href, router)` in `web/src/game/select-layout/`, with its test.
   The focus panel's `.jacket` is named `stage-jacket` (it's the only one on `/`). A plain click or Enter on a card's
   link calls `goToStage`; modifier and middle clicks stay native links. Under reduced motion, or without
   `document.startViewTransition`, it just pushes. Otherwise it starts one view transition whose update pushes the
   route and resolves once `section[aria-label="Stage"]` (stage-card's) is in the DOM, capped at 1 s. The jacket's
   group and the root crossfade run at most 400 ms, ease-out.
3. **`feat(select-to-stage)`:** the headless check in `web/src/game/select-to-stage/` and the done note.
   `goToStage` lives in select-layout because a `fix(select-layout)` can't import from a feature folder that isn't on
   `main` yet. Three PRs, two of them a few lines.
- learn-from-select, ui-sounds and select-stage also plan `fix(select-layout)` PRs (L, the confirm sound, the stage
  behind): the later one rebases and keeps both.

## Requirements
- Enter or a click on a song: the focused jacket scales and moves into the stage card's jacket in at most 400 ms,
  while the rest of the screen crossfades. One view transition per navigation.
- Reduced motion: a cut (no view transition starts). Without the API, or with no stage card within 1 s (`next dev`
  compiling `/play` on its first visit, say): a cut, never an error or a stuck screen.
- Only one element per page carries `stage-jacket`: the focus panel's jacket on `/`, the stage card's on `/play`.
- `web/e2e/verify.mjs`'s front-door step (Enter on `song-twinkle` opens `/play?song=twinkle`) passes unchanged.

## Validation
- `pnpm -C web test`: `goToStage` pushes once with no transition under reduced motion and without the API, and
  starts exactly one transition otherwise (a fake `document`).
- `node web/src/game/select-to-stage/verify-move.mjs --out <dir>`: Playwright, `/` at 1280×720 and 1920×1080, after
  `next build && next start` (dev compiles `/play` on first visit): Enter on Twinkle -> screenshots at 0, 200 ms and
  settled. Fail unless `document.getAnimations()` holds an animation on `::view-transition-group(stage-jacket)` of at
  most 400 ms. With `reducedMotion: "reduce"` -> no view transition starts (wrap `document.startViewTransition` in an
  init script).
- No `bot=` scene: the move ends before Start. `verify.py --slug select-to-stage` passes; it presses Enter on the
  select, so it runs this path.
- Eric's eye (mark it in the done note): does it feel like the song you chose became the stage.
  `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill; review with
`design-taste-frontend`'s step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots.

## Defaults
- The wait before the move (route and chart load) shows the frozen select. Record it on `next start` in the PR; if
  it's over 300 ms, prefetch the chart on focus as a follow-up, not here.
- If React's own integration also starts a transition during the push, keep exactly one (the check above fails
  otherwise) and log how in `specs/decisions/select-to-stage-*.md`. No new dependencies.

Issue: #259.
