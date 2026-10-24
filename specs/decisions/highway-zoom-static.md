# highway-zoom: off by default, the keyboard static (#384)

**Context.** Eric played Für Elise with zoom on by default for wide charts: "it just feels weird having it dynamically resize throughout the game... incredibly wrong". A pianist finds notes by where the keys sit. Lanes that pan and widen mid-song move every key under the player's eyes.

**Options.**
- A: raise `easeMs`, the spec's own fallback, so the motion is slower.
- B: zoom off by default, behind `?zoom=on`.
- C: delete the feature.

**Choice: B,** Eric's call in #384. A still moves the keys, only more slowly. C loses a working pan that may serve a wide chart's practice view later.
- `zoomOn` ignores the chart's width; the `minWhiteKeys` setting is gone.
- Core's `makeLayout` lays one range per song, from C to C (`fix(core-loop)`, #391). Zoom's `fullRange` is that range.

**How to undo:** in `zoomOn`, return to "on when the static range is wider than N white keys", with `minWhiteKeys` back.
