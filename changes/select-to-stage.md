## What shipped
Enter or a click on a song moves the focused jacket into the stage card's jacket with one view transition (400 ms,
ease-out) while the rest crossfades. Reduced motion, no API, or no stage card within 1 s: a cut.
## Where it lives
`web/src/game/select-layout/go-to-stage.ts` and its test (#354), the stage card's inline name (#353), the check in
`web/src/game/select-to-stage/verify-move.mjs`; frames in `specs/features/select-to-stage/`; choices in
`specs/decisions/select-to-stage-inline-name.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (select-to-stage, c121876);
`verify-move.mjs` passes: one transition, jacket 400 ms at 1280 and 1920, none under reduced motion.
## Gaps
The select freezes 309–401 ms before the move (chart load on `next start`): prefetch on focus is a follow-up. Eric's
eye: not verified by Eric.
