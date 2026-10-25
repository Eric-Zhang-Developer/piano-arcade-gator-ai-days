## What shipped
Five songs from Mutopia notation MIDI, bringing the library on `main` to fifteen (twenty with song-pack-3, #745): `gnossienne-1` (bars 1–9 in the edition's 4/4, 66 BPM, 84 notes, F2–F5), `entertainer` (intro and A strain, 66 BPM, 345, G1–E6), `mountain-king` (bars 1–17, 130 BPM, 168, B0–F♯4), `alla-turca` (the A-minor section with its repeats, 100 BPM, 514, A2–C6), `minute-waltz` (bars 1–20, 116 BPM, 214, G♯2–A♯5). Note counts from the LilyPond sources equal the charts' (R + L: 22+62, 185+160, 104+64, 282+232, 109+105), less the unison and ornament notes the decision file names.
## Where it lives
`web/public/songs/{gnossienne-1,entertainer,mountain-king,alla-turca,minute-waltz}/chart.json`, `specs/decisions/song-pack-4-excerpts.md`, `specs/decisions/song-pack-4-gnossienne.md`. Gnossienne's CC BY-SA 4.0 credit: #795, a separate `docs:` PR.
## How to check it
The 53 test files that read every chart: 691 passed (the library test's Perfect player gives all five 100% PERFECT through the judge). `/play?song=<id>` with `?input=test` and Gnossienne's `&from=1&to=4`: not verified locally (Eric's load rule), covered by main's scheduled full run.
## Gaps
- **Validation skipped:** Eric on the piano (it's the piece, lanes readable, Medium to Expert order right, which `bpm` needs tuning). No browser play-through or widest-chart screenshot (the Entertainer, G1–E6).
- **The level scale doesn't follow the spec's rungs:** Gnossienne 8, Alla turca 9, Minute Waltz 10 (at 41% of its marking), Mountain King 12, the Entertainer 13. Every tempo is at or under the MIDI's; Eric tunes them.
- Hand edits after the converter (Gnossienne's cross-staff chords, the Entertainer's intro), and ornaments left out: grace notes, Alla turca's trill termination, the Minute Waltz's pralltrillers as main notes.
- `sheet-xml` has no key, meter or pickup overrides for these five (Alla turca opens with `\partial 4`); `/sheet` uses its estimates.
