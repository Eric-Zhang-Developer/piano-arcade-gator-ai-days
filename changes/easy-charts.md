## What shipped
An Easy level for every chart: `?level=easy` thins a chart to at most about 4 notes a second, the top note of each chord per hand, both hands only when every note fits the laptop keys. E on the music select switches Normal and Easy (a cyan pill pair under the stats, remembered across reloads); cards, L and best grades follow the level, and an Easy take saves under `<song>@easy`. An Easy take keeps the song's own keyboard (decision A).
## Where it lives
`web/src/game/easy-charts/` (`chart.ts`, `level.tsx`, `index.ts`, `verify-easy.mjs`); `specs/decisions/easy-charts-keyboard.md`; toggle screenshots in `specs/features/easy-charts/screenshots/`. Wired by #458 (ghost), #459 (records) and #464 (select-layout).
## How to check it
`verify-easy: pass` (all 4 steps, both sizes) and `verify: … pass at 5ca9b02 (uncommitted changes)`, 42/42 PERFECT with test input and through the MIDI path; the uncommitted changes were this PR's toggle restyle and check, committed unchanged. Eric: **not tried by Eric** (Chopin Easy on laptop keys, Für Elise Easy on the piano: fun, and still the song?).
## Gaps
The cards' LEVEL boxes keep the Normal level; only the focused song's toggle shows the Easy level. Moonlight's Easy level is 11 against Normal's 14, the least drop of any song; why is unexamined. Reduced-motion review skipped: the toggle has no motion.
