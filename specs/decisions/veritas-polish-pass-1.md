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

**Judged below.** Screenshots and taste v2's step-8 review ran after the planner's quiet window (2026-10-24).
Round 2's fixes stayed inside pass 1 (#607). **No pass 2:** the one remaining visible problem needs markup (#610),
which a `style(veritas)` pass can't fix.

**How to undo:** revert #607. The CSS before it is main's `veritas.module.css` at c6d5db0.

## The Look review (taste v2, step 8), 2026-10-24 after the quiet window
- **Round 1** (pass 1 as first pushed): design 7 · usability 7.5 · creativity 8 · content 8 → 7.5. Top three:
  1. Dense marks fused into glowing bars (Jitter's 79 EARLY/LATE, Chord Roller's 89 ROLLED).
  2. Planted rings merged into orange bars on the same runs.
  3. The sky's glow tiled every 1080 px with a seam.
- **Round 2** (fixed in #607):
  - EARLY/LATE/ROLLED drop to 0.6em with no glow, so a dense run reads as a band and its tally states the number.
  - Rings are 1 px.
  - The sky is drawn once.
  - The header paragraph has no orphan.
  - Score: design 7.5 · usability 8 · creativity 8 · content 8 → 7.8.
- **Stopped at round 2.** Chord Roller's ROLLED band is still three thin magenta lines, because 89 labels over about
  560 px overlap at any size. Fixing it needs markup (one mark per run of equal marks), which this feature can't
  add, so it's an issue for eric-foreman-agent.
- **The one exception to the 24 px floor:** dense EARLY/LATE/ROLLED marks are 0.6em (14 px at 1920). Not one of 79
  is readable at any size, and the tally beside them is.
- **Not applied:** the rubric's "decorative gradient" cap. visual-direction.md's synthwave sky and loud edges win,
  as the spec says. The "four real pictures" cap doesn't fit either: the spec forbids images.
