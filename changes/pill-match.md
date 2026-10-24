## What shipped
Ghost outlines now take x, width and corner radius from the note pill (`pillRect` and the highway's corner rule), so
they're rounded and match black-key pills; falling-note labels fit the pill's width (about 78% of a black key, not
84%), so none is wider than its pill. Both gaps the ghost and note-pills done notes left are closed.
## Where it lives
`ghostOutline` in `web/src/game/ghost/ghost.ts` (#399); `noteLane` in `web/src/game/note-labels/labels.ts` (#401);
before/after frames (Für Elise, 1920×1080) in `specs/features/pill-match/`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (pill-match, e07ac0c); verify-ghost and
verify-labels pass unchanged.
## Gaps
At 1920 on the C-to-C keyboard the D♯ label already fit its pill, so the labels frames look alike; the change shows on
narrow lanes (the unit test). Eric's eye: not verified by Eric.
