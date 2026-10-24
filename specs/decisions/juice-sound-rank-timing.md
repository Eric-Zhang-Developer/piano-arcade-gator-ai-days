# juice-sound: when the drumroll and rank hit play

**Context.** The spec wants "a drumroll before the rank reveal and a hit when it lands". `/play` shows the results
screen, rank included, the moment `songEnd` fires, and juice-visual's rank reveal is "a short scale-in" from there.
Nothing can sound *before* `songEnd` without predicting it.

**Options.** A: drumroll from `songEnd`, hit at `songEnd + soundSettings.rankHitMs` (900 ms); the visual reveal lines up
by starting its scale-in at the same offset. B: start the drumroll before the song ends, from the chart's known end.
C: hit at `songEnd`, no drumroll.

**Choice.** A. It needs no prediction, keeps every sound tied to one event, and is one number to change. A full
combo's fanfare follows the hit by 150 ms so the two don't stack. juice-visual (PR #99) is told the offset.

**How to undo.** Change `rankHitMs` (0 with no drumroll is option C), or schedule from `songStart` for option B.
