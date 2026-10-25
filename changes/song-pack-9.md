## What shipped
Five very easy songs, right hand only, each from its cited source: Hot Cross Buns (the "Alternative" B A G tune, 17 notes), Mary Had a Little Lamb (26), London Bridge (24), the Jingle Bells refrain (soprano, 51), and Frère Jacques copied from the round (32). Levels: 1, 1, 1, 2, 1, beside Twinkle's 1, with rows in `reviewed.ts`. Tempos: 120→100, 220→100, 102→102, 100→100, 102→102.
## Where it lives
`web/public/songs/{hot-cross-buns,mary-lamb,london-bridge,jingle-bells,frere-jacques-solo}/`, `web/src/game/difficulty/reviewed.ts`, `specs/decisions/song-pack-9-sources.md`, `CREDITS.md`.
## How to check it
`/play?song=<id>` for each, with `?input=test` for all PERFECT. Not verified locally; covered by CI.
## Gaps
No local browser run (ship-now rule). Eric's piano pass for `bpm` hasn't happened yet.
