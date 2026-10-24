---
name: "Black-key lanes: the lanes under black keys shaded a little lighter, like Synthesia"
depends_on: ["core-loop", "fever-stage"]
owns: ["web/src/game/black-key-lanes/"]
assignee: "eric"
---

# Black-key lanes

On a wide two-hand chart the highway is one black field with only the octave lines to find a lane by: Für Elise's
count-in shows all 31 white keys before highway-zoom narrows it (Moonlight and the Nocturne, 34). Shading the lanes
under black keys carries the keyboard's 2-and-3 pattern up the whole highway, as Synthesia does, so a lane reads at a
glance. Pills, keys and the hit line don't change.

Issue: #261

## Plan
Three code PRs, then the done note. The stage makes room first, so main never breaks its lane cap. The stage stays
fever-stage's: a spec that isn't done holds its `owns` exclusively (`in_flight` in `.agents/scripts/lib.py`), and
select-stage and fever-moment need their own `fix(fever-stage)` PRs meanwhile.
1. `feat(black-key-lanes)`: `blackKeyLaneSettings.tint` (0.04) in `web/src/game/black-key-lanes/`. Then a
   `fix(fever-stage)` PR: in `web/src/game/stage/index.ts`, the canvas opacity cap takes the tint out of `maxLaneLuma`:
   `min(1, (maxLaneLuma − tint) / ((1 − tint) × (1 − stageBackdropAlpha)))`, 0.78 → 0.72 at today's defaults.
   The why goes in `specs/decisions/black-key-lanes-stage-cap.md` (fever-stage's own decision file isn't this PR's).
2. **A `fix(core-loop)` PR:** `drawHighway` (`web/src/game/core/highway.ts`) fills each black key's lane with white at
   the tint, after the backdrop and before the octave lines and notes.
3. `feat(black-key-lanes)`: screenshots and the done note.

## Requirements
- **Lanes:** each black key in view gets a lane exactly its `keyX` span (core's black key, 0.6 of a white key), from
  the top of the highway to the judgment line, through the perspective. White-key lanes stay as they are.
  highway-zoom's view moves the lanes with the keys.
- **Amount:** a black lane is at most 0.04 luma (0–1, Rec. 709 weights on sRGB values) lighter than the white lane
  beside it. On the plain highway that's `#000` to about `#0a0a0a`.
- **Under everything:** notes, octave lines, bar lines, ghost outlines and labels draw over the lanes. Pills keep
  their colors and sizes.
- **Stage cap:** with the stage on, a black lane's worst case,
  `tint + (1 − tint) × opacity × (1 − stageBackdropAlpha)`, stays at or under `stageSettings.maxLaneLuma` (0.35).
  The cost: the whole stage draws about 8% dimmer.
- `tint: 0` turns the shading off and gives back today's stage opacity. There's no URL switch.

## Validation
- `pnpm -C web test`: stage: at the default tint the worst case above is at most `maxLaneLuma`, and at tint 0 the
  opacity is today's 0.35 / 0.45. Core: on a C4–C5 chart (core pads it to B3–D5), `drawHighway` fills 6 lanes with
  the tint, C♯4 to C♯5, after the backdrop and before the first note's fill.
- `verify.py --slug black-key-lanes` passes. So does `node web/src/game/stage/verify-stage.mjs --out <dir>`.
- Headless Chrome at 1920×1080, mid-song on `/play?song=fur-elise&bot=perfect`, with and without `&stage=off`
  -> the black lanes read faintly lighter, and the pills look as before. Screenshots before and after go in the PR.
- On the piano (Eric; mark it in the done note): play Für Elise with both hands. Do you find a lane faster?
  `not verified by Eric` until he does.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with taste v2's
(`design-taste-frontend`) step 8, "Look": 1280×720, 1920×1080 and reduced motion. Before and after screenshots go in
the PR.

## Defaults
- Lighter, not darker: the highway is `#000`, so a black lane can only lift. If it reads as clutter, lower the tint
  before anything else.
- Shading only: no lane borders and no new lines.
- bar-lines edits the same spot in `drawHighway`. Whichever lands second rebases and keeps the order: backdrop,
  black lanes, octave lines, bar lines, notes.
- Log a choice the spec doesn't make in `specs/decisions/black-key-lanes-*.md`.
