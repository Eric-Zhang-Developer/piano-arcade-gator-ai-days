# roll-pages-polish: the sonata roll's role

**Context.** /sonata's roll is a focusable canvas stepped with the arrow keys (#1205). As `img` it said nothing about
the keys or where you are, and the spec left the choice between a slider and an `img` with the hint in its label.

**Options.** A: `role="slider"`, value = the selected note. B: keep `img` and put the arrow-key hint in `aria-label`.

**Choice.** A. The roll is a one-dimensional control the arrow keys move, which is what a slider is, and screen readers
already announce the value on each step. `aria-valuetext` is short ("Note 706 of 707, PR #1161"): the live region
right beside it reads the PR's subject and meta, so a long valuetext would read them twice.

**How to undo.** Swap the five aria attributes on the canvas in `SonataPage.tsx` back to `role="img"` with the hint in
`aria-label`, and update the slider assertions in `build-sonata.test.ts`.
