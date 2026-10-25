# menu-test: horizontal spacing and the flick

**Context.** The spec carries the component's tilt, depth, fade, perspective, falloff and gap, but not how far
apart the cards sit, or how far a flick throws.

**Options.** A: linear spacing, `offset × width × (1 + gap)`. B: the same falloff curve as tilt and depth,
`sign × |offset|^falloff × width × (1 + gap)`, so far cards bunch toward the edges.

**Choice.** B: one curve for x, z and tilt keeps the ring tidy, and 10 songs fit at 1440 px without leaving the
frame. A flick adds `velocity × 0.25 s` (capped at two cards by the spec); a release held still for 80 ms adds nothing.
Two more small additions: a card also fades to 0 over its last card before half a ring, so the wrap never shows
however few songs there are, and the settle is a 450 ms cubic ease-out.

**How to undo.** Change `x` in `cardPose` or `flickTarget` in `web/src/app/mt/motion.ts`.
