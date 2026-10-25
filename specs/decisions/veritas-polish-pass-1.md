# veritas-polish: pass 1's direction

**Context.** `/veritas` is a shot in the demo video (#515). The spec allows CSS only (`veritas.module.css`, plus a
`className` on an existing element), in `visual-direction.md`'s look: the hero loud, the dashboard calm.

**Choices (pass 1, #607):**
- **The strip is a lane, not a chart.** Each take's strip gets the playfield's black and a faint time grid. Its notes
  start at 35% brightness and flare white as the playhead reaches them, from the per-note delay the judge's marks
  already use (`--i`, `--x`). That's the direction's "brightness is time to hit", and the sweep reads as a take
  being played. The alternative, keeping the notes static cyan ticks, left the 4 s sweep a bar crossing dots and put
  chrome cyan where notes are.
- **Notes are white, not mint or azure.** Mint and azure mean a hand, and the strip doesn't show hands, so they'd
  be a false claim. White is the flare, the note's own color at the line.
- **Marks stamp.** 300 ms, slight overshoot, the direction's stamp, in their own color with a glow. ✕ stays the only
  red.
- **Two takes a row at 1920, the golden test across the top.** One column at 1920 put most of the hero below the
  fold. 700 px is the narrowest a strip stays readable, so 1280 keeps one column.
- **Every read text at the video floor:** the marks went from 14/18 px to 1em, and the page font is already
  max(16px, 1.25vw): 16 px at 1280, 24 px at 1920.
- **The dashboard is a scoreboard:** framed, uppercase dim section labels, right-aligned seconds in Saira. The
  folder lines' `· N tests` stay in the body face: putting the number in Saira would need a `span`, which is markup
  this feature can't add.
- **No fixed background:** the sky's top-edge glow scrolls with the page. A fixed background repaints on every
  scroll frame, a likely stutter in a capture.

**Not yet judged.** Screenshots and taste v2's step-8 review come after the planner's quiet window (2026-10-24).
Pass 2 happens only if that review leaves a top-three problem.

**How to undo:** revert #607. The CSS before it is main's `veritas.module.css` at c6d5db0.
