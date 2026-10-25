# song-pack-3: excerpts, tempos and two hand edits

**Context.** The spec leaves each excerpt (30–90 s, from the opening) and `bpm` to the charter. Sources are Mutopia
804, 203, 5, 276 and 998. Notes were counted from each piece's LilyPond source, the file the Mutopia scan is engraved
from: chord notes one by one, a tied-to note not again, rests and grace notes not at all.

**Choices** (each reversible by rerunning `game-tools/midi-to-chart/convert.py` with other `--bars`/`--spans`/`--bpm`):
- **Clementi, Op. 36 No. 1:** the header names Op. 36 No. 1, and of its three MIDI files `sonatina-1.mid` is the 1st
  movement (2/2, its `\midi` block is `\upperfirst`). Bars 1–15 to the first double bar, twice, as its volta repeat
  asks (`--spans 0-60,0-60`; the MIDI plays it once). 100 BPM, under the MIDI's 156, for Easy. 71 s.
- **Burgmüller, L'arabesque:** the A section as played: the 2-bar intro, bars 3–9, the first ending, bars 3–9 again
  and the second ending (`--spans 0-20,4-18,20-22`). 70 BPM, under the MIDI's 152: the shortest excerpt that reaches
  30 s. Staccato notes keep their printed lengths.
- **Bach, Prelude in C:** Mutopia 5 (harpsichord/piano), not 2206 (two guitars). Bars 1–11, to the cadence in G.
  Both bass-staff voices (the half-note bass and the held tenor) are left hand at their printed lengths. 60 BPM, the
  MIDI's; the score marks none. 44 s.
- **Moonlight, 1st movement:** the same source as `moonlight-3`. Bars 1–9: the introduction and the first phrase to
  the cadence in E major. 60 BPM, the MIDI's. 36 s. Two edits after the converter:
  - Bar 5's first triplet (E3 G♯3 C♯4) is engraved in the bass staff but fingered for the right hand: R (the MIDI's
    bass track had it).
  - Bar 9's melody E4 and the triplet's E4 a beat-third later share a pitch, and the MIDI dropped the triplet's. Both
    are charted; the melody note ends where the triplet note starts, the converter's rule for same-pitch overlap.
- **Mozart, K. 545:** bars 1–12, the theme, the runs and the half cadence on G before the second theme; the repeat
  sign is at bar 28, past the excerpt. Bar 4's trill is its main note. 92 BPM, under the MIDI's 132. 31 s.

**How to undo.** Change the bars or `bpm` and reconvert; for Moonlight, redo the two edits above. The library test
checks the result.
