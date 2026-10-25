# laptop-sound: where a laptop key is sounded

Context: the spec had `keysDevice` call `laptopKey` right after its `keyMap` lookup. laptop-octaves shifts laptop-key
pitches by Z/X octaves afterwards, in its `wrapInput`, so a key sounded in `keysDevice` would play the unshifted note:
an octave off from the note the judge scores.

Options:
- A: sound it in `keysDevice` (spec as written; wrong octave after Z/X).
- B: have laptop-octaves tell laptop-sound its shift (a new coupling across two features).
- C: sound it in `/play`'s `onInput` for laptop-key events, which sees the shifted pitch.

Choice: C (#622). `onInput` still runs inside the key event, so it adds no frame wait. It also runs before the pause
check, as a piano's keys sound while paused. The cost: pages that use `keysDevice` without `/play` (`/simon`) don't
get laptop-key sound from laptop sound; `/simon` keeps its own tone for laptop presses only when it finds no piano
output.

How to undo: move the one `laptopKey` line from `web/src/app/play/page.tsx` into `keysDevice`'s handler.
