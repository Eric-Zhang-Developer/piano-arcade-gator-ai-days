# mascot: the default gator and the seven others

**Context.** Spec `mascot` (#1371) leaves the shapes, line weight, palette mapping, poses and the tutor's pick to
the worker. Eric: "I want a chibi gator, but I want to be incredibly minimalistic."

**Options.** Eight directions were drawn by hand (`specs/features/mascot/shots/directions-1280.png`):
- A, the flat pebble: four flat shapes, with the eyes and mouth cut out by a mask and one ink tooth;
- B, two hands: blue head, violet body;
- C, monoline in ink;
- D, a 16×16 pixel sprite;
- E, the head only, inside the kit's brackets;
- F, a monoline head;
- G, blue with gold teeth;
- H, chomp, an open geometric jaw.

**Choice: A.** Its proportions are the most chibi, it reads at 28 px (the select row) and in one colour, and it uses
only `--pa-primary` and `--pa-ink`.
- The cut-outs are a `<mask>`, not dark paint, so on any field the holes show the field.
- The viewBox is cropped to the art (`2 5 43 43`), so it fills the tutor's 72–120 px slot.
- There's one pose. Nothing on screen moves the gator yet, so idle and tutor poses would be scope with no screen.

**The others ship as files,** `web/public/mascot/b-*.svg` … `h-*.svg`, under the same palette test. Lab entries are
cut by the spec.

**How to undo or swap.** Copy another variant over `web/public/learning/companion-gator.svg` and
`web/public/mascot/a-flat.svg`, then update the equality line in `duo-results/mascot.test.ts`. Or `git revert` the PR: the old PNG is untouched.
