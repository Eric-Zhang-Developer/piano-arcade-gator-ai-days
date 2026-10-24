# select-to-stage: the shared name is an inline style

**Context.** The spec's plan put `view-transition-name: stage-jacket` in the two CSS modules. Next's CSS modules hash
the value as well as the class: the select's jacket came out `_3sLSTq_stage-jacket` and the stage card's
`dCe1hq_stage-jacket`, so they never paired and the move was a plain crossfade (seen in `document.getAnimations()`).

**Options.** A: inline `style={{ viewTransitionName: "stage-jacket" }}` on both jackets. B: a global stylesheet for
the two names. C: name them from `goToStage` at runtime.

**Choice.** A. Two attributes, no new file, and the name sits next to the element it moves. The timing still comes
from `updateTiming` on `ready` (the spec's plan): every view-transition animation measured 400 ms.

**Wait.** On `next start` the stage card appeared 309–315 ms (1280) and 325–401 ms (1920) after Enter (two runs), over the spec's 300 ms,
so prefetching the chart on focus is a follow-up. React started no second transition (one start counted per move).

**How to undo.** Drop the two `style` props; the navigation goes back to a cut.
