# song-pack-2: excerpts and tempos

**Context.** The spec leaves each excerpt (30–90 s) and `bpm` to the charter, with defaults for a sparse opening
(Gymnopédie) and an unplayable tempo (Moonlight). Sources are Mutopia 37, 1778, 1590, 23 and 276.

**Choices** (each reversible by rerunning `game-tools/midi-to-chart/convert.py` with other `--bars`/`--bpm`):
- **Gymnopédie No. 1:** bars 22–31, 56 BPM (MIDI 60). The opening is sparse, and in bars 1–18 this edition prints the
  left hand's chords in the treble staff, so they'd chart as right hand. Bars 22–31 are one phrase with melody alone
  in the treble and the chords in the bass staff.
- **Clair de lune:** bars 1–8, to the first cadence, 60 BPM (the MIDI's tempo); bar 14 was the other stop (63 s).
- **Nocturne Op. 9 No. 2:** pickup + bars 1–8 (theme and its ornamented restatement), 60 BPM, a little under the
  marked eighth = 132. Turns and the trill come through as main notes; three grace notes are skipped.
- **Maple Leaf Rag:** pickup + the A strain twice (this MIDI plays repeats), 100 BPM, a little under the MIDI's 120.
- **Moonlight, 3rd movement:** bars 1–8, up to bar 9's new figure, 60 BPM: about 38% of a usual quarter = 160, so the
  arpeggios can be read at all.

**How to undo.** Change the bars or `bpm` and reconvert; the library test checks the result.
