## What shipped
Five Easy-medium to Medium songs, from Mutopia notation MIDI. Every source, license, tempo and rebuild command is in `specs/decisions/song-pack-6-sources.md`.

| Song | Rung | Excerpt | Printed tempo | MIDI | bpm | Notes (R+L) | Range | Level |
|---|---|---|---|---|---|---|---|---|
| `chopin-prelude-7` | Easy-medium | the whole prelude | "Andantino" | ♩=120 | 90 | 167 (101+66) | A1–C♯6 | 8 |
| `brahms-waltz-15` | Easy-medium | bars 1–16 | none | ♩=116 | 90 | 251 (138+113) | G♯1–G5 | 9 |
| `traumerei` | Medium | bars 1–8 with the repeat | none | ♩=56, rubato map | 56 | 217 (123+94) | F2–A5 | 5 |
| `invention-1` | Medium | bars 1–14 to the A minor cadence | none | ♩=80 | 76 | 315 (161+154) | D2–B5 | 7 |
| `mozart-331-theme` | Medium | the Tema's A section with the repeat | "Andante grazioso" | ♪=112 | 56 | 212 (96+116) | E2–E5 | 6 |

- **Lengths at the chart's `bpm`:** 33, 32, 73, 45 and 51 s. No metronome number is printed in any of the five.
- **Note counts:** counted from each LilyPond source, bar by bar. Each equals the chart's, less the unisons sounded
  once: Träumerei's three same-staff unisons, and the Invention's E4 struck by both hands at beat 49.75.
- **Levels beside the library:**
  - Library Easy-medium: Burgmüller's Arabesque 5, Chopin's Prelude in E minor 5.
  - Library Medium: Bach's Prelude in C 4, Gnossienne 5, Moonlight 1st movement 5, K. 545 6, Gymnopédie 6, Für Elise 7.

## Where it lives
- `web/public/songs/{chopin-prelude-7,brahms-waltz-15,traumerei,invention-1,mozart-331-theme}/chart.json`
- `specs/decisions/song-pack-6-sources.md`
- Converter fixes: #999 (32nd notes, merged) and #1012 (LilyPond grace groups, for Träumerei).
- The Invention's CC BY-SA credit goes in `CREDITS.md` through a separate `docs:` PR.
- `web/src/game/song-jacket/index.ts`: three new ids re-roll their generated jacket, which otherwise matched another song's angle and first color (minute-waltz, mozart-545-1, nocturne-op9-2).

## How to check it
Every test that reads `public/songs` (54 files, among them the library, sheet-xml and song-jacket tests): 936 passed. A
Perfect player on the game's `Judge` gives each of the five all PERFECT. `/play?song=<id>`: not verified locally;
covered by main's scheduled full run.

## Gaps
- **Validation skipped:** Eric's piano pass (is it the piece, are the lanes readable, which `bpm` needs tuning). No
  browser run, under the load rule.
- **Two levels are far above their rung:** Chopin at 8 and Brahms at 9, against the library's Easy-medium songs at 5.
  Both have wide leaps and dense chords (maxLeap 31 and 28 semitones, chordShare 0.98 and 0.94). Difficulty wasn't
  retuned here.
- **Not charted:**
  - The grace notes. Chopin's is in bar 15. Träumerei's are in bars 2 and 6; bar 8's acciaccatura is charted as its
    main note.
  - Träumerei's ritardandos.
  - The Invention's ornaments, charted as their main notes: pralltriller in bars 1, 2, 6 and 8, and mordents in
    bars 5 and 13.
- **One hand edit:** four Träumerei releases are set to the score after the converter. The decision record says which
  ones and why.
- **No dynamics on three:** Brahms, Träumerei and the Invention vary neither velocity nor CC7 in their MIDI. Chopin's come from
  its note-on velocities, K. 331's from CC7.
