# wait-hud: where the note count sits, and LEARN as a framed badge

**Context.** The spec puts `note n / N` "where the counters were" and LEARN "where the score and multiplier were", with
positions from `hudLayout` and `hudSettings`. In the Look pass (taste v2 step 8, 1920×1080), round 1 centered the
count in the old counters zone (x ≈ 902). Alone there, it sat 58 px off the screen's center column, where the sun,
the judgment word and the giant combo all line up, and it looked accidental. Bare LEARN text read as a stray word
rather than a badge.

**Options.** A: keep the counters zone's own center. B: the screen's center, which is still inside that zone. For
LEARN: bare text, or the word in a cyan rounded frame.

**Choice.** B, and the frame. The count is in the score's face and size, with a NOTE label under it the way the HUD
labels SCORE. LEARN is italic 900 Saira at the multiplier's size (h × 0.5) in `--pa-cyan`, inside a cyan outline.

**How to undo.** `drawWaitHud` in `web/src/game/wait-hud/index.ts`: `mid` back to `cardW + (width × 0.34) / 2`, and
drop the `roundRect` stroke.
