# flow-mode: judging cases the spec doesn't spell out

**Context.** The spec defines a right note, WRONG, a skipped note, a chord's inner note and a lost stop. Four presses
fall between those rules.

**Choices.**
- **A re-struck pitch of the front** (a chord note pressed twice) is a harmless extra: no WRONG, and it doesn't skip
  ahead even if a lookahead onset has that pitch. Otherwise a bounced chord note would MISS the chord's other notes.
- **Outside the song** (more than a beat before the first note, i.e. the count-in, or after every note is judged) a
  press is a harmless extra, as core's Judge ignores presses outside the song.
- **A lost stop** breaks the combo with a `combo` event of count 0, not a `noteMiss` or `wrongNote`: nothing was
  missed or played wrong, and the note still waits. It doesn't step the fever gauge.
- **A chord's inner note credited GOOD** counts as a hit for the combo, so the combo holds and grows through it.

**How to undo.** Each is one branch in `FlowJudge.press`, `advance` or `passOver` in `web/src/game/flow-mode/judge.ts`.
