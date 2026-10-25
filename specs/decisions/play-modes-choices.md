# play-modes: what the spec left open

**Context.** The spec names the ladder, the reader and writer, held tempo, graduation and the defaults, but not these.

**Choices** (each reversible in its own file):
- **Flow has no tempo** (`inMode`). Every link into Flow drops `?tempo`: the practice links, the adaptive and chunk
  steps, and the ladder's Flow rung. Flow's clock already follows the player, so a 70% would only slow the chart under
  it and rescale the readout. `withMode` itself keeps every param, as the spec says. Undo: make `inMode` call
  `withMode` alone.
- **After a Learn step the walk goes on in Flow.** `adaptUrl` and chunk practice's play step read a Learn take as Flow
  (PRACTICE opens Flow, and Learn's next rung is Flow). From a Perform walk, Learn's results still offer Perform one
  click away.
- **Practice in chunks on a Flow start screen.** `isPlainTake` now means a plain Perform or Flow take, so "Practice in
  chunks" shows in Flow too and starts its walk in Flow. Learn has none, as before.
- **Next for you remembers the mode.** `NextFor.mode` is stored with the bars. A Flow take now saves one (records'
  practice rule, minus `mode`); a Learn take still saves none. An old entry with no mode opens Perform, as before.
- **Graduation is in Flow's own results panel,** under its headline, not in duo-tutor's line: a bar-range Flow take
  has no tutor (duo-results skips loops), and the spec links graduation to the same bars.
- **The furthest step is written on `songEnd`** by the play-modes plugin: Learn on any finished Learn take, Flow when a
  Flow take graduates, Perform when a Perform take is a record take (records' `practiceReason` is null). Bots, demos
  and the cabinet demo write nothing. "Sets a record" is read as "counts as a record take": the first one is always
  the best, and the ladder never goes down, so both readings light the same steps.
- **The hard-song nudge** focuses the Flow rung from an effect after Start's autoFocus, and gives it the next-step look
  (primary hairline and ›), since a programmatic focus draws no ring.
- **Where the ladder sits.** The start screen: the whole modes row, with the mode's own line under it as its caption.
  The results: its own slot under the rank band (`resultsLayoutSettings.ladder`), not in the actions grid, whose
  `!important` button styles would flatten the rungs. wait-mode left the actions list, since it has no results panel.
  The select: a read-only mark under the data cells; the roll went from 17vh to 14vh (7vh with a Next for you strip) to
  pay for it.
- **`song-preview/opening.ts` `practiceUrl` is unchanged:** nothing on a screen links to it (only its test), and #600
  is open on that file.

**How to undo.** Each item names its function or file; revert that one.
