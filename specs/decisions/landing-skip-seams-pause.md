# landing-skip-seams: a pause in the out (#1336)

**Context.** Under `?x=results-landing`, the out runs from T0 (the last note's end) to the results' mount, 400 ms. Esc
there opened the pause menu, and the results mounted over it a moment later: a flash, then gone. By T0 every note is
already judged.

**Options.**
- A: refuse the pause for the out. Esc stops in a capture listener before /play's own, and the pause button is
  hidden until the mount.
- B: let the pause hold the landing clock until Resume.

**Choice.** A. It's the smaller change, and it lives entirely in `results-landing/index.ts`. B needs /play's
`page.tsx`, which #600 and #1359 hold, and it would pause a take that has nothing left to play. After the mount, Esc
is the skip's, as before.

**Also settled here.**
- **#1334, the stamp's sound.** The drumroll and rank hit are scheduled on the audio graph at songEnd, in
  `sound/index.ts` (#600's file). A skip lands the picture at once, but the hit still sounds at its planned time.
  That gap is accepted (the spec allows it) and noted in the done note.
- **The reduced-motion shot.** It wasn't taken: the in-app browser can't emulate `prefers-reduced-motion`, and a
  `matchMedia` stub only reaches the JS path. The change adds no motion; verify-landing's step 4 still covers reduced
  motion in CI.

**How to undo.** Revert the commit. Esc and the button reach /play's pause during the out again.
