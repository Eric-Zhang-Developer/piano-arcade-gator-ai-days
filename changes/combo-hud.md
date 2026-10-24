## What shipped
The combo moved off the lanes into the HUD band's center, between PERFECT/GREAT/GOOD and MISS/WRONG: full strength,
Saira 900 italic, the band's biggest number, from a combo of 5. Milestones from 50 swell it (its ghost clipped to its
slot); reduced motion changes it in place. Nothing in the HUD draws below the band, so no numeral covers notes (#311).
## Where it lives
`web/src/game/hud/index.ts` (`hudLayout` slots, `drawHud`) and `hud.test.ts`, via #322; screenshots in
`specs/features/combo-hud/`; choices in `specs/decisions/combo-hud-slots.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (combo-hud, 489b46e); verify-hud passes
unchanged; `sweep.mjs --song clair-de-lune` 25% and 50% shots show no numeral over the notes.
## Gaps
The judgment word stays over long-note bodies by the planner's decision on #311. Eric's eye: not verified by Eric.
