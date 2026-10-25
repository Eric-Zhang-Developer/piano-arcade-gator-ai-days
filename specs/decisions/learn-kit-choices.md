# learn-kit: what the spec left open

- **The roll's labels:** `Passage.tsx` drew the octave labels at `min(rowH - 3, 11)` and `.beatLabel` at 11px, both
  user units in a 1000-wide viewBox, so 9.7 px on screen at 1280×720.
  - Both are now 14, which renders 12.4 px at 1280 and above 13 px at 1920.
  - The label no longer shrinks with short rows. Only the C rows carry one, so a 14-unit "C4" can spill into the
    next row on the key strip, where nothing else is drawn.
  - At windows narrower than 1280 it still renders under 12 px, since it scales with the SVG. The spec's floor is for
    1280 and 1920.
- **The cyan:** `rgb(39 225 255 / a)` becomes `color-mix(in srgb, var(--pa-primary) a%, transparent)`, at the same
  alpha (8%, 6%, 40%).
  - The playing phrase's figcaption, the rule right after (`var(--pa-cyan)`), moves to `--pa-primary` too, so the
    phrase and its caption match. That's one line past the spec's two.
  - Left alone, and listed in the done note's Gaps: `.app ::selection` (`--pa-cyan`) and `.app .primary:hover`
    (`#85edff`). The spec didn't name them.
- **The encoding comment:** it said the shell's focus ring was magenta. It's `--pa-primary` now, so the comment says
  "the focus ring".

**Undo:** revert the PR.
