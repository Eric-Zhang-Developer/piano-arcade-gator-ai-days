## What shipped
Minuet in G major (BWV Anh. 114): a second song in the library, playable at `/play?song=minuet-g` and listed on `/`. It's the right hand of the A section, bars 1–16, with the repeat written out: 128 notes over 32 bars of 3/4, all `hand: "R"`.
## Where it lives
`web/public/songs/minuet-g/chart.json`, `web/src/game/songs/minuet-g.test.ts`
## How to check it
`pnpm -C web verify` passed at a7d0e2b (evidence `.git/agent-evidence/minuet-g/20261024T070631Z`). `pnpm -C web test` runs the four Minuet tests. Live in the built-in browser, the Perfect player scored 128/128 PERFECT, 100%, rank S. Count: Mutopia piece 75's MIDI, right-hand track, bars 1–16, has 65 notes. Dropping the grace note leaves 64, matching the LilyPond source bar by bar (5+3+5+3+5+5+5+1, twice). Times two for the repeat: 128.
## Gaps
Not done: Eric at the piano ("is it the Minuet you know?"). `bpm` 100 is a playability default, not from the score, and Eric tunes it by playing. The B section is left for a later PR. Ornaments are charted as their main note (the grace before bar 8, the mordents in bars 3, 5, 11 and 13). The spec calls this the song list's second row, but song-select lists Minuet first (it sorts by title).
