---
name: "Sheet beams: beamed eighths and sixteenths, and beams and stems in their notes' judgment color"
depends_on: ["sheet-xml", "sheet-view"]
owns: ["web/src/game/sheet-beams/"]
assignee: "eric"
---

# Sheet beams

The sheet has to read from the piano bench, during a take and after it. Two things stop it. Eighths still print
with flags where a score would beam them: sheet-view turned on OSMD's `autoBeam`, but its shots show runs broken into
pairs and lone flags (`specs/features/sheet-view/shots/fur-elise-followed.png`). And a judgment is hard to see.
`setColor` already colors the notehead, stem, flag and accidentals (`specs/decisions/sheet-view-look.md`), but beams
stay ink, so a judged run reads as gold heads under a white beam. Eric's call: PERFECT's gold `#ffe27a` is about
1.15:1 in luminance against unjudged `--pa-ink` noteheads and barely shows. No recolor can fix that by luminance:
GREAT (1.26:1), GOOD and MISS sit between the gold and the black page. So the lever is colored area.

Issue: #378

## Plan
Measure first, then the smallest fix the numbers allow.
1. `feat(sheet-beams)`: pure `beamGroups(meter)` and `shouldBeam(placed, meter)` in `web/src/game/sheet-beams/`.
   `shouldBeam` marks the notes that ought to share a beam (Requirements). Tests. No done note.
2. `fix(sheet-view)`:
   - publish `beams: { should, beamed }` in `window.__pianoArcadeSheet`: how many of `shouldBeam`'s notes OSMD drew
     under a beam (its VexFlow note's `beam`). Measure all ten charts on main and put the table in the PR.
   - set `autoBeamOptions.groups` from the chart's meter.
   - in `follow.ts`, paint beams by the rule below.
   If `beamed` still falls short of `should` with the groups set, add a `fix(sheet-xml)` that writes `<beam>`
   elements from `shouldBeam`, and turn `autoBeam` off in the same `fix(sheet-view)` order.
3. `feat(sheet-beams)`: `verify-beams.mjs`, before-and-after shots, the done note.

## Requirements
- **Beat groups:** a quarter note in n/4 and 2/2, a dotted quarter in 3/8, 6/8, 9/8 and 12/8 (whole eighths
  divisible by 3). Any other meter: a quarter.
- **What beams:** in one voice of one staff, two or more consecutive eighths or shorter (chords count once) inside
  one beat group, with no rest between, share one beam. A lone eighth keeps its flag. No beam crosses a barline,
  a beat group or a rest.
- **Color:** a judged note colors its notehead, stem, flag and accidentals, as today. A beam takes a judgment's color
  once every note under it is judged and they all agree; until then, and when they differ, it stays ink. A tied
  note's later pieces stay as today.
- **Unchanged:** the judgment colors, the legend, the cursor, unjudged `--pa-ink`, and every note's pitch and onset.

## Validation
- `pnpm -C web test` (sheet-beams): Für Elise's 3/8 groups a dotted quarter. Four 16ths in one beat of 4/4 are one
  group. 8th, rest, 8th in one beat are two lone flags. Two eighths across a beat are two groups. A chord pair beams
  once. The beam color rule: all PERFECT is gold, PERFECT with GREAT is ink, PERFECT with one unjudged note is ink.
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/sheet-beams/verify-beams.mjs --out <dir>`. It prints `verify-beams: pass` and exits 0, or names
  each failure and exits 1.
  1. For each of the ten charts, `/sheet?song=<id>`: `beams.beamed === beams.should`. It prints both per chart. If main
     already passes this step, the beaming half is done and the PR says so. Steps 2 and 3 still fail on main.
  2. `/sheet?song=ode-to-joy` with `/play?song=ode-to-joy&bot=perfect` in the same browser context -> every beam in
     the SVG carries PERFECT's paper gold (`paperJudgmentColors.PERFECT`, `#9b7900` since #730; it was `#ffe27a`). With `bot=sloppy` -> no beam carries a judgment color unless all its notes share it.
  3. Readability, from screenshots at 1920×1080 after the Perfect take: pixels within ΔE76 10 of that gold, divided
     by the 122 notes. It must be higher than the same page with only its beams repainted ink, as it drew before this
     feature. (Until #730 the bar was main's count before the feature; no commit has the paper without beam colors.)
     Both numbers, and each judgment color's luminance ratio against `--pa-paper-ink` and against `--pa-paper`, go in
     the done note.
- `verify-sheet.mjs --out <dir>` and `verify.py --slug sheet-beams` pass. Eric (mark it in the done note): /sheet on the second monitor, from the bench, during an Ode to Joy take. Can he
  tell the gold notes from the unjudged ones?

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
`design-taste-frontend`'s step 8, "Look", at 1280×720 and 1920×1080 plus reduced motion, also viewed at 25% scale
as a stand-in for the bench. Before and after screenshots go in the PR.

## Defaults
- The groups are the usual engraving rule, not read from each source. 2/2 beams by the quarter, not the half.
- If the 25%-scale Look still can't tell PERFECT from unjudged, give judged noteheads a 2 px glow in their own color
  (an SVG drop-shadow on the notehead) and log it. Don't dim unjudged music: MISS's pink would then sit at about
  ink's luminance.
- No beams over rests, cross-staff beams or tuplets. Log choices in `specs/decisions/sheet-beams-*.md`.
