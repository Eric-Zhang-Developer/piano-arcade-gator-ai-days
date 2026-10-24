## What shipped
Highlighting a song on `/` (↑/↓ or hover), after 400 ms, plays its first two bars: on the DGX (channel 1, the chart's velocities, else 80) or as quiet laptop tones, capped at 8 s. A row under the stats shows notes per second, the best grade (blank if never played) and PRACTICE 70% (bar-loop on the whole song). Nothing sounds before the first key press or click. Moving on, Enter, pagehide and the opening's end all stop it with All Notes Off.
## Where it lives
`web/src/game/song-preview/` (#224); the hookup in `web/src/game/select-layout/` (#231); `specs/decisions/song-preview-start.md`.
## How to check it
`verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim` (its first step still opens Twinkle from `/`), and `node web/src/game/song-preview/verify-preview.mjs --out <dir>`: 12/12, covering Chrome steps 1–3 headless plus a stand-in DGX.
## Gaps
Not tried on the real piano (Eric: scroll the list; each opening plays and nothing hangs). The piano path was checked against a stand-in MIDI output, not the DGX. The jacket on `/` is smaller (38vh, down from 48vh) to fit the row at 720 px. The opening starts on its first note, not on beat 0 (decision file).
