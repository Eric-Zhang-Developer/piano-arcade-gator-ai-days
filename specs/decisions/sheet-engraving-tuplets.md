# sheet-engraving: how triplets are written

**Context.** moonlight-1's notes sit on the eighth-triplet grid (99%), which DIVISIONS 4 can't hold. The spec allows
raising DIVISIONS or writing tuplets, whichever is smaller.

**Options.** (a) DIVISIONS 12 alone. (b) `<time-modification>` and `<tuplet>` alone, on DIVISIONS 4. (c) Both.

**Choice: (c).** Neither works alone. (b) can't happen: a triplet eighth is 4/3 of a 16th, so its `<duration>` isn't
a whole number of divisions. (a) gives the right times, but with no `<time-modification>` a duration of 4 is no
printed value, and OSMD draws a "3" only for a `<tuplet>`. So DIVISIONS is 12 (a 16th is 3, a triplet eighth 4), and
each triplet piece carries 3:2, with a tuplet start on its beat's first triplet and a stop on its last.
Compound meters (6/8, 9/8, 12/8) never get triplets, because they already divide the beat in three.

**How to undo.** Set `DIVISIONS` to 4 in `sheet-xml/index.ts` and `sheet-beams/index.ts`, and remove the triplet
grid (4) from `GRIDS`.
