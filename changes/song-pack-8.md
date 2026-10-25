## What shipped
Five showpieces from Mutopia notation MIDI for the Medium-hard to Expert rungs:
- `liszt-consolation-3`: bars 1–18, 60 BPM, 256 notes, C2–D♭6, level 6.
- `rachmaninoff-prelude-cs`: the Lento, pickup and bars 1–13, 60 BPM, 466 notes, C♯1–B5, level 11.
- `pathetique-3`: the Rondo, pickup and bars 1–43, 192 BPM, 528 notes, G1–F6, level 10.
- `chopin-revolutionary`: bars 1–18, 120 BPM, 464 notes, G1–A♭6, level 15.
- `chopin-fantaisie-impromptu`: bars 1–24, 120 BPM, 582 notes, C♯2–B6, level 11.

Counts from the LilyPond sources equal the charts' (R + L: 70+186, 230+240, 263+265, 180+284, 315+267), less the Prelude's four unisons, which are kept once.
## Where it lives
- Charts: `web/public/songs/{liszt-consolation-3,rachmaninoff-prelude-cs,pathetique-3,chopin-revolutionary,chopin-fantaisie-impromptu}/chart.json`.
- Decisions: `specs/decisions/song-pack-8-excerpts.md`.
- Credits for the CC BY 3.0 and CC BY-SA 4.0 sources go in a separate `docs:` PR.
## How to check it
`pnpm -C web exec vitest run src/game/songs src/game/song-jacket`: 45 pass. The library test's Perfect player gives all five 100% PERFECT through the judge. `/play?song=<id>&input=test` is not verified locally; main's scheduled full run covers it.
## Gaps
- **Tempo:** markings, MIDI tempo and chart `bpm`, per song:
  - Consolation: Lento placido, no number; MIDI 60; chart 60.
  - Prelude: Lento, no number; MIDI 60; chart 60.
  - Rondo: Allegro, no number; MIDI ♩=216; chart 192.
  - Étude: Allegro con fuoco ♩=160; MIDI 160; chart 120.
  - Fantaisie-Impromptu: no marking printed; MIDI 168; chart 120.
- **Validation skipped:**
  - Eric hasn't played them on the piano (is it the piece, are the lanes readable, which `bpm` needs tuning).
  - No browser play-through.
  - No screenshot of the widest chart, the Fantaisie-Impromptu at C♯2–B6.
- **Levels miss two rungs:**
  - The Consolation is 6, under Alla turca's 9 and the Minute Waltz's 8.
  - The Fantaisie-Impromptu is 11, with the Hard songs; Moonlight-3 is 15.
  - Difficulty isn't retuned here.
- **Changed after conversion:**
  - The Étude's bars 6–9: 41 right-hand notes taken back from the lower staff.
  - Two ids were renamed off taken jackets.
  - The Rondo's eight grace notes are skipped, and its bar-16 trill is charted as its main note.
- **Not this pack's:** demo pedal and dynamics are `demo-performance`'s. `sheet-xml` has no overrides for these five.
