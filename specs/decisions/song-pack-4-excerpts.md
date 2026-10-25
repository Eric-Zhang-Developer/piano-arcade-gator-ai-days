# song-pack-4: excerpts, tempos and hand edits

**Context.** The spec leaves each excerpt (30–90 s, from the opening) and `bpm` to the charter. Sources are Mutopia
2035, 263, 1888, 108 and 483. Notes were counted from each piece's LilyPond source, the file the Mutopia scan is
engraved from: chord notes one by one, a tied-to note not again, rests, spacers, grace notes and hidden notes not at
all.

**Choices** (each reversible by rerunning `game-tools/midi-to-chart/convert.py` with other `--bars`/`--spans`/`--bpm`
and redoing the edits below):
- **Gnossienne No. 1:** bars 1–9, the first theme to its held F (meter: `song-pack-4-gnossienne.md`). 66 BPM; the
  score says only Lent, the MIDI 100. 33 s. Edits: the C4–F4 chords are printed in the treble staff but stemmed
  across to the bass A♭, so they're L (31 notes). Bar 8's F4 stays R: the melody's tied F starts there and the
  chord's F4 is the same key, kept once. Three chord F4s in bars 8–9 take their chord's printed length (the MIDI's
  held melody F had stretched or cut them).
- **The Entertainer:** the intro and the A strain once, ending on the 2nd ending's C chord before its pickup into B
  (`--spans 0-38,70-71.25`; the MIDI unfolds the repeat). 66 BPM ("Not fast"; the MIDI is 72). 36 s. Edits: the
  intro's octaves cross the staves, so bar 1's lower octave (stems down in the treble) is L, and bar 3's A–B–A–A♭ and
  bar 4's first G (stems up in the bass) are R (11 notes).
- **Hall of the Mountain King:** bars 1–17, the fermata octave and the theme in B minor and F♯ to the C♯ half
  cadence. The speed-up is at bar 50; all 49 bars before it would be 85 s of one theme. 130 BPM, under the marked
  138. 31 s. The MIDI went through `articulate.ly`: staccato lengths are shortened and velocities carry the accents.
- **Rondo alla turca:** the A-minor section to the double bar before the A-major chorus, with both repeats written
  out: A, A, B with A′, B with A′ (`--spans 0-16,0-16,16-48,16-48 --start-beat 1`). Without the repeats it's 29 s.
  100 BPM for an Allegretto with no number. 58 s. Edit: A′'s cadence trill keeps its main note B4, held to the beat;
  its printed 32nd-note termination (A–B) is left out like the grace notes.
- **Minute Waltz:** bars 1–20, the first section to the repeat sign at bar 21. 116 BPM, 41% of the MIDI's quarter =
  280 (Molto vivace), as the spec allows. 31 s.

**How to undo.** Change the bars or `bpm` and reconvert, then redo the edits above. The library test checks the
result.
