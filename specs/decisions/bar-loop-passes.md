# bar-loop: a set number of passes instead of "until stopped"

**Context.** The spec says the loop runs "until stopped". `/play` (core-loop's file) has no way to end a song early:
a song ends when its last note's window closes, and plugins can only transform the chart, watch events, draw and
wrap input. The results screen is core-loop's too.

**Options.** A: a `fix(core-loop)` PR first, adding a stop control and a results hook. B: repeat the bar range a set
number of times in the transformed chart, and show the per-pass list as the plugin's own panel next to the results.

**Choice.** B, with `?passes=<n>` (1–20, default 4). Retry plays another set. It needs no change outside
`web/src/game/bar-loop/`, and the spec's verify step (two Perfect passes, two 100% passes listed) is
`&passes=2`.

**How to undo.** When `/play` gets a stop control, raise the default to the maximum and let Stop end the set.
