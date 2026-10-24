## What shipped
Three songs from public-domain Mutopia notation MIDI: `ode-to-joy` (soprano R + bass L of the SATB setting, 16 bars, 80 BPM, 122 notes, pitch 43–74), `chopin-prelude-4` (pickup + bars 1–12, 44 BPM, 305 notes, 47–74), `fur-elise` (bars 1–23 with both repeats written out, 66 BPM, 294 notes, 40–88). A MIDI-to-chart converter with voices, pickups, spans for repeats, grace-note skipping and a self-test; one library test over every chart. Note counts from the scans equal the charts' (Ode 62+60, Chopin 38+267, Für Elise 186+108, counted bar by bar off the Mutopia PDFs).

## Where it lives
`web/public/songs/{ode-to-joy,chopin-prelude-4,fur-elise}/chart.json`, `game-tools/midi-to-chart/` (`convert.py`, README with the exact commands), `web/src/game/songs/library.test.ts`, `specs/decisions/song-pack-1-excerpts.md`, `specs/features/song-pack-1/fur-elise-highway.png`

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/song-pack-1/web verify ...` pass at 5ffe64f; library test 6/6; `convert.py --self-test` ok; headless Perfect player 100% PERFECT on all three

## Gaps
- Validation step skipped: Eric on the piano (it's the piece, lanes readable, rung order right, which `bpm` needs tuning). All three `bpm`s are guesses for Eric to tune.
- Ode to Joy is a hymn harmonization, not a piano arrangement (#110). Skipped: Chopin's bar-11 grace note; Für Elise's last three chords of bar 23 (they lead into the next section). No hand crossings or unisons came up.
- All sources are public domain, so nothing goes in `CREDITS.md`. Sources aren't committed; fetch them per the README.
