# sheet-engraving: the display grid

**Context.** The sheet rounded every onset to the nearest 16th. A run that sat a little off the eighths printed as
dotted notes and 16ths, so nothing beamed (mountain-king: 0 beams). Only the drawn rhythm snaps; the chart's times
for play and judging are untouched.

**Choice.**
- **Per staff and beat**, the onsets snap to the coarsest grid that every onset in that beat sits within **0.06
  beats** of. Eighths come first, then eighth triplets (not in compound meters), then 16ths. A beat that fits none
  (moonlight-1's 16th melody over triplets, bars 19 and 23) snaps each onset to the nearer of the 16th and triplet
  points. 0.06 is under half the gap between a 16th and a triplet (1/12 beat), so a real 16th never reads as a
  triplet.
- **Ends** snap on the grid of the beat they fall in, so a staccato quarter (gnossienne-1's and mountain-king's 0.83)
  prints as a quarter, not a dotted eighth and a 16th rest. A note keeps at least one step of its grid.
- Surveyed on every committed chart, before this change: only moonlight-1 (34 beats) and one beat of
  chopin-prelude-4 pick the triplet grid. Beams go from 0 to 40 in mountain-king and from 36 to 38 in moonlight-1,
  and stay the same everywhere else.

**How to undo.** `TOLERANCE` and `GRIDS` in `sheet-xml/index.ts`. `GRIDS = [3]` with a tolerance of 1/8 beat is
the old nearest-16th rounding.
