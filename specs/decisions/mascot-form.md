# mascot: the default gator

**Context.** Spec `mascot` (#1371) leaves the shapes, palette and poses to the worker. Eric asked for "a chibi
gator, but incredibly minimalistic". He then rejected round 1 (`shots/round1-rejected-1280.png`: eight geometric
icons with jaws and teeth) and said "It has to be fucking cute."

**Options, round 2** (`shots/kawaii-1280.png`), all hand-drawn SVGs, since the spec bans image generation:
- A, the green loaf;
- B, the loaf in blue;
- C, a sticker with an ink outline;
- D, a happy pose;
- E, a nap pose;
- F, peekaboo.

**Choice: A, the green loaf.** It's kawaii chibi:
- the round head is about two thirds of the height, on a bean body with stubby feet;
- big glossy eyes, blush and a tiny smile, with no teeth;
- a long flat snout with a nostril bump and a bumpy tail make it a gator, not a frog or a dino.

Every colour is a ui-tokens value:
- the body is `tierX3` green;
- the eyes and mouth are `bg`;
- the highlights are `flare`;
- the blush is `hype` at 45%.

The viewBox is cropped to the art (`3.5 8.5 56 56`).

**D, the happy pose, is the tutor's for a take with no weak run** (Eric: "A." to "Ship A with D as the happy pose?").

**The others ship as files** in `web/public/mascot/`, under the same palette test.

**How to undo or swap.** Copy another file over `web/public/learning/companion-gator.svg` and
`web/public/mascot/a-loaf.svg`, or `git revert` the PR. The old PNG is untouched.
