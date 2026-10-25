## What shipped
Five songs from Mutopia notation MIDI, bringing the library to fifteen: `clementi-sonatina-36-1` (bars 1–15 with the repeat, 100 BPM, 270 notes, D2–D6), `burgmuller-arabesque` (A section with the repeat, 70 BPM, 161, G3–E6), `bach-prelude-c` (bars 1–11, 60 BPM, 176, D3–A5), `moonlight-1` (bars 1–9, 60 BPM, 147, F♯1–B4), `mozart-545-1` (bars 1–12, 92 BPM, 191, G2–C6). Each chart's note count equals its score's, counted from the LilyPond source the scan is engraved from (R + L: 182+88, 60+101, 132+44, 119+28, 119+72).
## Where it lives
`web/public/songs/{clementi-sonatina-36-1,burgmuller-arabesque,bach-prelude-c,moonlight-1,mozart-545-1}/chart.json`, `specs/decisions/song-pack-3-excerpts.md`. Credits for the two CC BY-SA sources: #759.
## How to check it
Library test and the tests that read every chart: 60 passed (the library test's Perfect player gives all five 100% PERFECT through the judge). `/play?song=<id>` with `?input=test`: not verified locally (Eric's load rule; both dev-server slots were taken), covered by main's scheduled full run.
## Gaps
- **Validation 3 skipped:** Eric on the piano (it's the piece, lanes readable, Easy to Medium order right, which `bpm` needs tuning). Every tempo is under the MIDI's; Eric tunes them.
- **No browser play-through or widest-chart screenshot** (Clementi, 4 octaves): no free dev-server slot.
- **Two Moonlight hand edits** after the converter (decision file). Mozart's bar-4 trill is its main note.
- Difficulty rates all five Lv 6–7, Clementi included, so the rungs aren't Easy-to-Medium on the level scale.
