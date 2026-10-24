# Clear card: removing the banner, and the look

**Context.** The spec plans a `fix(juice-visual)` that deletes juice's FULL COMBO banner and the rank's wait for it.
By then rank-stamp (`stampStartMs`) and juice-sound (the rank hit) also waited on the banner.

**Choices.**
- One scopeless `fix:` PR (#309) removed the banner from juice-visual, rank-stamp and juice-sound together, since
  three scoped PRs would each leave main with two of them disagreeing. It merged before this one, so for a few minutes a
  full combo had only its fanfare.
- The card dims the playfield to 72% black (not lighter): at 55% the last judgment and the giant combo still read
  through the card. The text is 30% of the space between the HUD band and the judgment line, at most 90% of the width.
- The draw clears its own canvas at `songEnd`, because `/play`'s draw loop stops when the results show.

**How to undo.** `clearSettings` in `web/src/game/clear-card/index.ts`; revert #309 to bring the banner back.
