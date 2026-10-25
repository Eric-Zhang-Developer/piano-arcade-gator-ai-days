# note-material: where the 3:1 lives

**Context.** Validation (c) asks for a pill at its dimmest (`farBrightness`, before emission) to be 3:1 or more against
the field. The same spec says note-pills' 35% → 100% approach brightness stays. Both can't hold for the body fill.
Measured against `bg` (#030607), today's right-hand blue at 35% over the black underlay is **1.64:1**, and the left
purple is 1.61:1. The body needs about 61–64% to reach 3:1, depending on the hand color and the hand-palette
candidate.

**Options.**
- A. Floor the body's alpha at the 3:1 value. The far end then dims only from 100% to about 62%, and most of the depth
  cue is lost.
- B. Keep the body's approach dimming and give the pill's boundary, its rim, its own alpha floor at 3:1. WCAG 1.4.11
  asks that the graphical object be perceivable, and a 3:1 edge does that.
- C. Leave it under 3:1 and file the conflict.

**Choice: B.** `rimFloor(hand, field)` finds the lowest rim alpha that is 3:1 against the field, and the rim draws at
`max(brightness, floor)`. The test checks it for today's hand tokens and for every hand-palette candidate. A second
test pins that the body alone is under 3:1, so the reason for the floor is visible.

**How to undo.** For A, apply `rimFloor` to the body's alpha in `drawNote` too: one line. Delete the "keeps the
approach dimming" test.
