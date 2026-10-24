## What shipped
The results rank stamps down once the tally ends (1.2 s; 2 s after a full combo's banner): 1.6× to 1× in 300 ms with
one slight overshoot, a gold ring flashing out at impact, and juice-sound's rank hit on that impact. Reduced motion:
the rank shown at once, no ring.
## Where it lives
`web/src/game/rank-stamp/` (curve, keyframes, timing), drawn by `web/src/game/juice/index.ts`, heard from
`web/src/game/sound/index.ts`; frames in `specs/features/rank-stamp/`; choices in `specs/decisions/rank-stamp-timing.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (rank-stamp, f30a259)
## Gaps
The hit's timing is unit-tested, not heard. The tally still runs under the FULL COMBO banner until clear-card (#255)
removes it. Eric's eye: not verified by Eric.
