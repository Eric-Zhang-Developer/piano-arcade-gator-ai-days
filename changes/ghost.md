## What shipped
On Retry, your previous take of the same chart shows on the highway: each hit as a faint dashed outline of the note's length at the time you actually played it, and each extra (WRONG included) as a short dashed tick in its lane. Misses leave nothing. Outlines never fill, so the real notes read through them. A ghost is keyed by the chart id plus `song`, `from`, `to`, `tempo` and `hands`, kept in memory for the page's lifetime. A quit take doesn't replace it. It's off with `?ghost=off` or `localStorage["pianoArcade.ghost"] = "off"`, and hidden under `?perspective`. Opacity and dash live in `ghostSettings`.
## Where it lives
`web/src/game/ghost/` (`ghost.ts` pure recording and geometry, `index.ts` the plugin, `ghost.test.ts`, `verify-ghost.mjs`), one entry in `web/src/game/layers.ts` (right after the sim: after every chart change, under every visible layer), screenshots in `specs/features/ghost/screens/`.
## How to check it
`verify.py --slug ghost` pass at ef49762: 42/42 PERFECT with test input and through the MIDI path on /sim. `node web/src/game/ghost/verify-ghost.mjs --out <dir>` pass at ef49762: on Twinkle, a take played 40 ms late, then Retry: the next take showed 42 outlines trailing the notes, and the two takes after it were both 42/42 PERFECT. With `?ghost=off`, Retry drew none.
## Gaps
- Outlines are square-cornered rectangles, while notes are now rounded pills (note-pills). Readable, but not matched.
- Not tried by hand in desktop Chrome or on the piano (Eric: two takes of Twinkle; does the ghost read at a glance or get in the way?).
