---
name: "Select stage: the synthwave stage behind the music select"
depends_on: ["fever-stage", "select-layout"]
owns: ["web/src/game/select-stage/"]
assignee: "eric"
---

# Select stage

The music select (`/`) sits on a flat gradient while `/play` has fever-stage's synthwave stage. The same scene
behind the select, dim and scrolling slowly, makes the two screens read as one cabinet.

Issue: #265

## Plan
Two PRs, about an hour. fever-stage's files (`web/src/game/stage/`) don't change.
1. `feat(select-stage)` in `web/src/game/select-stage/`:
   - `selectStageDriver(scene, still)`, plain TypeScript, since Vitest has no DOM: `tick(nowMs, width, height)`
     renders `makeScene`'s scene with `look(emptyStage(), nowMs)` and `gridPhase(nowMs, bpm, 1)`, on every tick or,
     when still, on the first and on a new size. It feeds `frameBudget()` and freezes, with one log line, if it trips.
   - `<SelectStage />`: a fixed full-window element behind everything (`data-testid="select-stage"`, `aria-hidden`,
     `pointer-events: none`) with `.screen`'s gradient. Unless `stageOff`, an effect makes the scene and ticks the
     driver from `requestAnimationFrame` (still: on mount and `resize`); cleanup calls `dispose()`. `render` wants a
     `Frame` but reads only `width` and `height`. fever-stage's still frame is inside its plugin: this has its own.
   - `verify-select-stage.mjs`: the browser steps below.
2. `fix(select-layout)`: `MusicSelect` renders `<SelectStage />`, `.screen` drops its gradient, and any text backing
   goes on `.top` or `.focus`. Validate on this branch (both changes) before merging either; the done note cites it.
   (learn-from-select and select-to-stage also plan `fix(select-layout)` PRs: the later one rebases.)

## Requirements
- `/` shows grid, sun and stars behind everything, in fever-stage's tier-1 look: no fever, dip, flash or burst.
- **Same brightness as `/play`:** canvas opacity `selectStageSettings.opacity`, default `stageSettings.maxLaneLuma`
  (0.35), the level `/play` shows its stage at (a 0.78 canvas under a 0.55 backdrop). Enter doesn't change it.
- **Slow scroll:** one grid line per beat at `selectStageSettings.bpm`, on `performance.now()`.
- **Readable:** cards stay on `--pa-panel`. Off-card text keeps at least 4.5:1 (step 6): wordmark, hint, the focused
  song's title, composer and stats, song-preview's row and status, and the Calibrate link (already on a panel). Text
  that fails gets a `--pa-panel` backing on select-layout's `.top` or `.focus`, not in song-preview's or song-select's.
- **Reduced motion:** one still frame, drawn again only on a resize.
- **Off:** with `?stage=off`, `localStorage["pianoArcade.stage"]="off"` (fever-stage's switches) or no WebGL there is
  no canvas, and the gradient shows. When `frameBudget` trips, the stage freezes, as on `/play`.
- **One WebGL context at a time:** unmounting disposes the scene (`dispose` forces context loss). `/play` builds its
  stage only at Start, and React removes the select's canvas even if its context leaks, so count live contexts.
- ↑/↓, Enter, click, hover and song-preview work as before. There's no page scroll at 1280×720 or 1920×1080.
- Out of scope: cabinet's title screen (cabinet's files; it opens `/` with a full page load, so no shared context).

## Validation
- **After duo-select (#646),** which takes the stage off the select: the check confirms `/` mounts no stage and
  holds no live WebGL context, and stops there. The steps below hold while the select mounts the stage.
- `pnpm -C web test`, a fake scene counting renders: moving, the driver renders every tick until a scripted slow run
  trips the budget, then stops; still, it renders once, not again at the same size, and once more at a new size.
- `verify.py --slug select-stage` passes (its first step opens Twinkle from `/`).
- `node web/src/game/select-stage/verify-select-stage.mjs --out <dir>`, headless Chrome at 1280×720 and 1920×1080.
  An init script keeps every WebGL context `getContext` returns; live means `!isContextLost()`.
  1. Open `/` -> one canvas in `select-stage`, one live context. ↑/↓ moves the focus. Click a card -> `/play`; back.
  2. Enter on `/` -> `/play?song=…`'s start screen with 0 live contexts. Start -> 1. Go back to `/` -> 1.
  3. `/` and `/?stage=off` screenshots differ; `/?stage=off` has no canvas.
  4. Two screenshots 500 ms apart differ. (At 60 bpm the grid repeats every second: 1 s apart proves nothing.)
  5. With reduced motion emulated, two screenshots 500 ms apart are identical.
  6. Under reduced motion, make each listed text item's color transparent and take the 95th-percentile luminance
     pixel in its box (stars are random 1 px lines; the sun is large). Lay the text's color over it (`--pa-ink-dim`
     is 60% alpha) -> at least 4.5:1 each. `scrollHeight` is at most the viewport height.
  If software GL in headless Chrome trips `frameBudget` (its log line), run steps 4 and 5 headed and say so.
- Eric's eye (mark it in the done note): on the laptop, does the stage help or distract when you pick a song?
  `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before/after screenshots in the PR.

## Defaults
- `selectStageSettings`: `bpm: 60` and `opacity`; tune in the Look review, log in `specs/decisions/select-stage-*.md`.
- Cost: fever-stage averaged 6.9 ms a frame for all of `/play` on Eric's laptop (`changes/fever-stage.md`); this
  draws the same scene with less around it. `frameBudget` is the guard; rAF already stops in a hidden tab.
- The focused song's tempo doesn't drive the grid (an open question for Eric). No new dependency; prefer the smaller.
