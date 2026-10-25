---
name: "Duo select: piano-roll thumbnails, one PLAY plus PRACTICE, and a Next-for-you strip"
depends_on: ["duo-tokens", "select-layout", "song-jacket", "song-preview", "adaptive-chunks"]
owns: ["specs/features/duo-select/", "changes/duo-select.md", "web/src/game/duo-select/", "specs/decisions/duo-select-"]
assignee: "eric"
---

# Duo select

Issue #646. The music select in the Duo look (`specs/context/visual-direction.md`, frame `F-duo-1-select.jpg`).
Eric called today's select "unfit to show". It's the video's first screen after the cold open.

## What exists (origin/main, 2026-10-25)
- **select-layout** (`select-layout/index.tsx`) has two columns:
  - **left, `section.focus` (:101-124):** the jacket, title, composer, Level/Notes, `LevelToggle`, `SongPreview`;
  - **right, an `<ol>` of `SongCard`s (:140-144).**
- `<SelectStage/>` (the synthwave stage) is mounted at :92.
- **Jackets:** `SongJacket` (`song-jacket/SongJacket.tsx:5`), gradient and type from `jacketFor()`.
- **Buttons** are in song-preview: LEARN (:109), PRACTICE 70% (:114), and BEST as rank and accuracy (:106).
- **Keys:** Hands and Speed in song-options. Easy is the E key, L opens wait mode, W watch demo, O options, F first
  run, X lab.
- **Records:** `useBestGrades` (`records/best.ts:20`) gives each song's best. Nothing per bar is stored; duo-results
  adds `pianoArcade.nextFor.<songId>`.

## Plan
1. **`feat(duo-select)`, part 1:** `web/src/game/duo-select/roll.ts`, a pure function from a chart to piano-roll bars
   (the first ~8 bars, each note as a short bar at its pitch, colored by hand), with a test, and a `<PianoRoll/>`
   canvas component.
2. **`fix(select-layout)`, `fix(song-jacket)` and `fix(song-preview)`:**
   - the left panel in corner brackets: a large piano roll, the title, `COMPOSER · CATALOG` in monospace, three data
     cells (`LV`, `NOTES`, `BEST`), the "Next for you" strip, then **one PLAY** (primary) and **PRACTICE** (secondary);
   - the right column: sharp hairline rows, each with a small piano roll, the title, the composer in monospace caps,
     and `LV 05`, with the focused row marked by a `--pa-primary` bar on its left edge;
   - `<SelectStage/>` comes off the select (a `fix(select-stage)` if it owns the mount).
3. **`feat(duo-select)`, part 2:** `verify-select.mjs`, the screenshots, the done note.

## Requirements
- **The piano roll is drawn from the chart,** never an image. It's a glowing thumbnail where nobody reads notation,
  which visual-direction.md allows. Right hand in `--pa-primary`, left in `--pa-secondary`. Draw each one once per song
  and cache it, not every frame.
- **PLAY** opens the song as today, keeping hands, speed and easy. **PRACTICE** opens adaptive practice
  (`practice=adapt`, adaptive-chunks). The L key still opens wait mode, and the other keys are unchanged. The hint line
  reads like the frame: `↑↓ SELECT · ENTER PLAY · P PRACTICE`. Add a P key if it's free (log it).
- **BEST:** the stored best accuracy, or `—` when there's none. Never a placeholder number.
- **"Next for you":**
  - shown only when `pianoArcade.nextFor.<songId>` exists (saved by duo-results from a real take):
    `Next for you: bars X–Y, {left|right} hand`, with the gator from `web/public/learning/`;
  - clicking it opens `PRACTICE BARS X–Y` (bar-loop at 70%);
  - hidden otherwise. Never a made-up suggestion.
- **Fits 1280×720 and 1920×1080.** The list scrolls inside its column, never the page. Keyboard first, as today.
- **Removed from the select's face:** the speed and hands buttons may move into the options drawer or stay as small
  monospace toggles. The worker picks within the frame and logs it. Nothing they do is removed.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/duo-select`: `roll` gives one bar per note in the window,
   with the right pitch row and hand color, and an empty chart gives an empty roll.
2. Headless, once, under `verify.lock`:
   `python3 .agents/scripts/verify.py --slug duo-select --worktree . --cmd "node {worktree}/web/src/game/duo-select/verify-select.mjs --out {out}"`.
   It prints `verify-select: pass` or names each failed step:
   1. `/`: every row has a piano-roll canvas, and no stage canvas.
   2. Enter opens `/play?song=…`. P (or PRACTICE) opens `practice=adapt`. L still opens `mode=wait`.
   3. With `pianoArcade.nextFor.fur-elise` seeded, the strip shows its bars. With none, there's no strip.
   4. Screenshots `select.png` at 1280×720 and 1920×1080, plus reduced motion, with no page scroll.
3. Eric looks at it once. Mark it in the done note.

## How it's built and checked
Follow `specs/context/visual-direction.md`, build with the `frontend-design` skill, and review with taste v2's step
8, "Look", at 1280×720 and 1920×1080 plus reduced motion. Before and after screenshots go in the PR.

## Defaults
- **After duo-hud in the restyle.** Cut by Sunday noon (2026-10-25 12:00 ET).
- Log any choice this spec doesn't make in `specs/decisions/duo-select-*.md`.
