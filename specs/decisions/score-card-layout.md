# score-card: the card's layout and practice line

**Context.** The spec lists what the card shows, not where. It names two practice lines (`Bars 5–8 at 70%`, `Right hand`).

**Choices.**
- **Layout:** the jacket square on the left (780 px). The right column shares its top and bottom edges: the title and
  composer, a magenta rule, then the rank at 420 px with score, accuracy and max combo stacked beside it on its
  baseline, then the six counts on one row ending on the jacket's bottom edge. The date sits under the jacket, and
  PIANO ARCADE in the far corner. This took three look rounds. The first put the rank at the column's right, where it
  hit MAX COMBO.
- **Practice line:** taken from the params, not parsed from bar-loop's title, and only for what /play applied:
  `Bars X–Y at Z%` (tempo 100 when not given), `Right hand` / `Left hand` when the chart has both hands (hand-mode
  ignores the setting otherwise), `Whole song at Z%` for tempo alone (#547: the whole song once at that tempo),
  `Versus`, joined with ` · `. A bot isn't a practice line. bar-loop's title suffixes (` · bars 5–8 at 70%`,
  ` · 80%`) are still stripped, in case the plugin ever sees one.

**How to undo.** Edit `drawCard` and `practiceLine` in `web/src/game/score-card/card.ts`. The tests pin the strings,
not the positions.
