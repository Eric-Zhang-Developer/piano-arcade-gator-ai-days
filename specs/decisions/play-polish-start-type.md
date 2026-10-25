# play-polish: the start screen's type size, and what didn't move

**Context.** #1239 asks for the ladder, the mode buttons, the mode's caption, and Songs and Options to read on video:
at least 16 px at 1280×720 and 24 px at 1920×1080. If a row stops fitting, the spec asks to log what gave way.

**Choice.** All four take `clamp(16px, 1.25vw, 24px)`, the same value as the select's copy of the ladder (`.mark
.rung`, #1060), so the two ladders match. Measured in the in-app browser, nothing gave way: no button or rung
overflows, the bar row fits exactly (558 of 558 px at 1280, 838 of 838 at 1920), and neither size scrolls.

**Left alone.** The hand picker's chips (Right hand, Left hand, Both) stay at 12 px. They're outside #1239's four
items, and at 16 px they'd need about 372 px, which takes the bar row to about 632 of its 558 px at 1280. Bringing
them up means changing how the bar is laid out (the hands on a row of their own, say), which is a decision for a
spec, not this pass.

**How to undo.** The four `clamp` values in `duo-start/start.module.css` and `play-modes/ladder.module.css`.
