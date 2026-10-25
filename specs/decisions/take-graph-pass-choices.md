# take-graph-pass: the choices the spec leaves open

eric-agent-6, 2026-10-25. Each is the smaller, reversible option. Undo by changing the named constant or line.

- **Median window: 8 hits of one hand, centred.** Each run of 8 consecutive hits (misses carry no offset) gives one
  point, at the middle of its 4th and 5th hit. A trailing window lags 4 notes behind, which puts a rushed passage
  half a bar late on a 16th-note piece. The label reads the last run. `graphSettings.medianNotes`.
- **Tick spacing:** a hairline at every bar line. A number every 4 bars, which is sparser than weak-bars' 2-bar
  phrases, doubled until each number has 36 px (`graphSettings.labelPx`). Unnumbered bar lines are drawn at 45% of
  the line token, so 45 bars don't read as a fence.
- **The clip rule:** the plot spans ±GOOD plus 18% headroom. An offset past GOOD draws as a chevron in that
  headroom, pointing the way it went, in the hand's colour. The readout and the table keep the true value. The judge
  makes anything past GOOD a MISS today, so this only shows for windows other than the judge's (`windows` prop).
- **MISS row:** a miss has no offset, so its × sits in its own labelled row between the plot and the velocity strip,
  not on the zero line, where the trend lines covered it (round 1).
- **Draw-in:** a `clip-path` inset from the right to nothing, 600 ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`. It starts
  the first time a quarter of the graph is on screen (IntersectionObserver). results-landing (#978) plays above the
  fold and the graph sits below it in Details, so the draw-in never plays during the landing. Reduced motion draws
  at once.
- **Plot height:** 196 px up to 1400-px cards, then 14% of the width, capped at 260, so the 1920 card doesn't read
  flat. Type stays at its px size: the viewBox is the card's measured width.
- **Hand identity:** dataviz's validator fails the two hand tokens on the dark panel. Blue `#2b9bff` against violet
  `#a07cff` is ΔE 0.7 under deuteranopia and 13.3 for normal vision (the floor is 15). They're the game's hand
  colours (hand-colors), so this pass doesn't change them. Identity is also carried by shape (circle right, square
  left), the RH/LH direct labels and the header's legend. Retuning the tokens is a hand-colors change of its own.
- **House-style conflicts:** taste v2 bans monospace labels and hairline grids. The Duo kit's data face is mono
  (`fontData`), and the spec asks for mono labels and per-bar gridlines, so the kit and the spec win here.
