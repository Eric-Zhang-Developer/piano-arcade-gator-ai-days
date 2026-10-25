---
name: "Sheet engraving: clef changes, 8va, beat-grid beams and a readable zoom on /sheet"
depends_on: ["sheet-view", "sheet-paper"]
owns: ["specs/features/sheet-engraving/", "changes/sheet-engraving.md", "specs/decisions/sheet-engraving-"]
assignee: "eric-agent-6"
---

# Sheet engraving

Issue #827. Eric, 2026-10-25, comparing our `/sheet` for Flower Dance with a published arrangement: the notes are
"fucking gigantic" and the page is "unreadable", above all where the left hand climbs toward the treble. He asked for
one fix: clef changes and 8va, display quantize to the beat grid so beams come back, and a sensible default zoom.

## What exists (origin/main, 2026-10-25)
- **Fixed clefs.** `sheet-xml/index.ts:85` puts a note on its hand's staff (`staff: n.hand === "L" ? 2 : 1`), and
  bar 1 writes treble and bass once (:198). A climbing left hand stacks 6–8 ledger lines above the bass staff. There
  is no `<octave-shift>`.
- **A 16th grid.** `DIVISIONS = 4` (:9); onsets and ends round to the nearest 16th (:83-84). A run that sits a little
  off the eighths prints as dotted notes, 16ths and ties, so sheet-beams' `shouldBeam` finds nothing to beam.
- **No triplets.** moonlight-1's 147 notes: 51% sit on the 16th grid, 99% on the eighth-triplet grid (measured for
  this spec from `web/public/songs/moonlight-1/chart.json`). DIVISIONS 4 can't write them.
- **Zoom.** `SheetView.tsx:42-50` fits the zoom to the window, 150% at 1920 wide, and `saveZoom` (:220) stores that
  fitted value after the first render, so a 1920 window keeps 150% even after the default changes.

## Plan
One `feat(sheet-engraving)` PR by eric-agent-6, after sheet-paper's PRs (#725, #730, #708) merge, so the same
worker never has two PRs on sheet-view at once. Ownership is open within the `eric` lane (AGENTS.md), so it changes
other game-lane features' `owns` once no open PR works on those files. It is a fix in all but name, so it reproduces
the problems on origin/main first (the shots and test lines below). Files:
- `web/src/game/sheet-xml/index.ts`: display quantize, DIVISIONS, tuplets, clef changes, 8va.
- `web/src/game/sheet-xml/sheet-xml.test.ts`: the cases in Validation.
- `web/src/game/sheet-view/SheetView.tsx`: the default zoom. `follow.ts` only if its onset match (:47) needs the
  new DIVISIONS or the display grid.
- `web/src/game/sheet-beams/index.ts` only if `shouldBeam` must group triplets.
- `changes/sheet-engraving.md`, and `specs/decisions/sheet-engraving-*.md` for choices made.
Past about 400 changed lines, split it at the seam: quantize and triplets first, then clefs, 8va and zoom.

## Requirements
- **Clef changes per measure.** When a passage of one hand needs more than about 3 ledger lines on its staff, that
  staff changes clef for the passage (a MusicXML `<clef>` in the bar's `<attributes>`) and changes back after.
  Notes stay on their hand's staff. No flip-flop: one stray note doesn't change the clef.
- **8va and 8vb.** Where a run sits far above the treble staff (or below the bass) even after any clef change,
  write `<octave-shift>` (8va above, 8vb below) and print the notes an octave nearer the staff. Pitch as played is
  unchanged: `placeNotes` still reports each note's real pitch, so sheet-view's notehead match still works.
- **Display quantize to the beat grid.** For the sheet only, snap each onset and end to the coarsest grid that fits
  within a tolerance: eighths before sixteenths (and the triplet grid, below). Steady eighths then print as eighths,
  and sheet-beams beams them. Notes still play at their chart times: the chart, judging and the highway are
  untouched; only the drawn rhythm snaps.
- **Triplets for moonlight-1.** Raise DIVISIONS (12 holds 16ths and eighth triplets) or write tuplets
  (`<time-modification>` and `<tuplet>`). #827 and its comments don't pick one; the worker picks the smaller and logs
  it in `specs/decisions/sheet-engraving-tuplets.md`. Either way, moonlight-1's triplets print as triplets with a 3.
- **A sensible default zoom.** The default is 100% (#827), not the window fit. The notes aren't gigantic, and several
  systems fit at both 1280×720 and 1920×1080. A zoom the player picked with − or + is still remembered; the fitted
  value isn't stored as if picked (store only on a press, under a new key so the old stored 150% doesn't stick).
- **Unchanged:** sheet-paper's panel and colors, the cursor, notehead coloring, the legend, `/sheet?review=1`.

## Not here
Off-grid charts are fixed by the tempo map in #831, not here. Flower Dance (63% of notes on the eighth grid) and
Golden's charts (6–11% on the 16th grid) carry tempo changes baked into their beats, so no display grid can make
them read like an engraved score. Re-charting them is chart work. Both are local content, not on main.

## Design
A visible change, so it follows AGENTS.md's Visible changes: invoke `frontend-design` before the UI change and
`design-taste-frontend` (taste v2) for the look loop. Take a dev-server slot (`devserver.1` to `.4`), screenshot
`/sheet` at 1280×720 and 1920×1080 through the in-app browser, score against taste v2's `references/critique.md`, fix
the top three problems, at most three rounds. Before and after shots (fur-elise, moonlight-1, and a two-hand chart
whose left hand climbs) and each round's score go in the PR's Design section.

## Validation
- `pnpm -C web test` (sheet-xml), on synthetic charts:
  - a left hand that climbs mid-piece writes a clef change in that bar and the clef back after the passage;
  - a high right-hand run writes an 8va `<octave-shift>` start and stop, and `placeNotes` keeps the real pitches;
  - a run of eighths each a little off the grid comes back as beamed eighths (`<beam>` begin, continue, end), no ties;
  - a moonlight-1 triplet (from its chart) comes back as three triplet eighths in one beat;
  - the existing sheet-xml tests still pass over every library chart.
- The existing `verify-sheet*.mjs` checks stay green, covered by main's scheduled full run. No local verify: the
  done note says "not verified locally; covered by main's scheduled full run".
- The design pass above, with its Design section in the PR.
- Eric looks once (mark it in the done note): /sheet on fur-elise and moonlight-1. Readable?

## Defaults
- The ledger-line threshold, the quantize tolerance and the clef hysteresis are the worker's to tune; log them in
  `specs/decisions/sheet-engraving-*.md`.
- No cross-staff notes, dynamics or pedal marks.
