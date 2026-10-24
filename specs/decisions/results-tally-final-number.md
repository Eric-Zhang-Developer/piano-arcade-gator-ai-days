# Results tally: the final number stays in the DOM

**Context.** Seven verify scripts (core-loop's verify.mjs, verify-sim, verify-hud, verify-ghost, verify-labels,
verify-stage, verify-warning) read `count-*` as soon as `[data-testid=results]` appears. The spec says scripts that
read before the tally ends should wait for it.

**Options.** A: make every script wait for the tally's end (seven files in five other features' folders). B: keep
`data-testid="count-*"` on a visually hidden span holding the final number from the first frame, and draw the
tallying number beside it, `aria-hidden`.

**Choice.** B: no other feature's files change, screen readers hear the result once instead of a run of numbers, and
the visible number still ends exactly on the same value (tested in `results-tally.test.tsx`).

**Also.** The tally starts when the results screen mounts, under juice's rank reveal. Ordering the two is
rank-stamp's job, and clear-card (#255) removes juice's FULL COMBO delay.

**How to undo.** Put the testid back on the visible number in `Tally` and add a wait to each script.
