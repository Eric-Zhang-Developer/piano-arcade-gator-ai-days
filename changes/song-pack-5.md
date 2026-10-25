## What shipped
Five Easy-pack songs from Mutopia notation MIDI. Every source, license and tempo is in `specs/decisions/song-pack-5-sources.md`.

| Song | Excerpt | bpm | Notes (R+L) | Range | Level |
|---|---|---|---|---|---|
| `minuet-g-minor` | bars 1–16 with the repeat | 90 | 194 (112+82) | B♭2–B♭5 | 5 |
| `musette-d` | the whole piece, both repeats | 90 | 342 (182+160) | D2–A5 | 7 |
| `happy-farmer` | the whole piece | 90 | 352 (240+112) | B♭2–F5 | 6 |
| `wild-horseman` | A twice, then B | 120 | 312 (147+165) | C3–F5 | 8 |
| `old-french-song` | bars 1–16 | 60 | 91 (50+41) | G2–E♭5 | 4 |

- **Tempo, printed against MIDI:**
  - The two Bach pieces print none; their MIDI tempos are 140 and 120.
  - Happy Farmer: "Frais et gaillard", MIDI 100.
  - Wild Horseman: "vif", MIDI 152.
  - Old French Song: "Moderato assai.", MIDI 70.
  - No metronome number is printed anywhere. Every `bpm` is below its MIDI's; Eric tunes them.
- **Note counts:** counted from each piece's LilyPond source, bar by bar. Chord notes count one by one; tied-to notes,
  rests and spacers don't count. Each count equals the chart's, less the same-staff unisons sounded once (2 in the
  Happy Farmer's L, 4 in the Old French Song's L).

## Where it lives
- `web/public/songs/{minuet-g-minor,musette-d,happy-farmer,wild-horseman,old-french-song}/chart.json`
- `specs/decisions/song-pack-5-sources.md`
- The CC BY-SA credit for the two Schumanns is a separate `docs:` PR, linked from #968.

## How to check it
`pnpm -C web exec vitest run src/game/songs/library.test.ts`: 32 passed. The Perfect player gives each new chart
all PERFECT. `/play?song=<id>`: not verified locally; covered by main's scheduled full run.

## Gaps
- **Validation skipped:** Eric's piano pass (is it the piece, are the lanes readable, which `bpm` needs tuning), and
  the screenshot of the widest chart (the Musette, D2–A5), both under the load rule.
- **Two levels sit far above Easy:** the Musette at 7 and the Wild Horseman at 8, against the library's other Easy
  songs at 1–3. That comes from their running notes at these tempos. Difficulty wasn't retuned here.
- **Ornaments left out:** the Minuet's pralltriller (bars 8, 9, 15) and mordent (bar 13) are charted as their main
  note. The Musette's fermata isn't held.
- **No velocities:** none of the five MIDI files varies velocity or CC7, so no chart has dynamics; that is
  `demo-performance`'s later job. `sheet-xml` has no overrides for these five either.
