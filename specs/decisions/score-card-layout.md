# score-card: the card's layout and practice line

**Context.** The spec lists what the card shows, not where. It names two practice lines (`Bars 5–8 at 70%`, `Right hand`).

**Choices.**
- **Layout:** the jacket square on the left (780 px). The right column shares its top and bottom edges: the title and
  composer, a magenta rule, then the rank at 420 px with score, accuracy and max combo stacked beside it on its
  baseline, then the six counts on one row ending on the jacket's bottom edge. The date sits under the jacket, and
  PIANO ARCADE in the far corner. This took three look rounds. The first put the rank at the column's right, where it
  hit MAX COMBO.
- **Practice line:** taken from the params, not parsed from bar-loop's title: `Bars X–Y at Z%` (tempo 100 when not
  given), `Whole song at Z%` for tempo alone (#547), `Right hand` / `Left hand`, `Versus`, joined with ` · `. A bot
  isn't a practice line. A bar-loop suffix on the title is still stripped, in case the plugin ever sees one.

**How to undo.** Edit `drawCard` and `practiceLine` in `web/src/game/score-card/card.ts`. The tests pin the strings,
not the positions.
