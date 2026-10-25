# song-pack-7: the five sources, checked before charting

eric-agent-6, 2026-10-25. This is the spec's plan step 1. Each row of the table was checked against its Mutopia page
and the files on it. All five hold: the right piece, Public Domain, and a MIDI, a PDF and a LilyPond source.

| id | Mutopia | Piece in the file | Edition (typesetter) | License | Printed tempo | MIDI tempo |
|---|---|---|---|---|---|---|
| `chopin-prelude-20` | [472](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472) | Prelude Op. 28 No. 20, 4/4, 13 bars | Edition Peters (Magnus Lewis-Smith) | Public Domain | "Largo" | ♩ = 42 |
| `raindrop-prelude` | [471](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=471) | Prelude Op. 28 No. 15 ("Raindrop"), 4/4 | Edition Peters (Magnus Lewis-Smith) | Public Domain | "Sostenuto" | ♩ = 80 |
| `pathetique-2` | [295](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295) | Sonata Op. 13, 2nd movement, 2/4 | Berners 1908 (ed. Winterberger) and Peters 1910 (Chris Sawer) | Public Domain | "Adagio cantabile" (its `\tempo 4=36` is hidden) | ♩ = 36 |
| `moment-musical-3` | [1023](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023) | Moment musical No. 3, D. 780, 2/4 | Sauer & Leidersdorf, Vienna 1827 (Claude Chaudron) | Public Domain | "Allegro moderato" | ♩ = 80 |
| `debussy-arabesque-1` | [1777](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1777) | Première Arabesque, L. 66 No. 1, 4/4 | Durand et Fils 1904 (Keith OHara) | Public Domain | "Andantino con moto" | 𝅗𝅥 = 72 (♩ = 144) |

- **Where the numbers come from:**
  - Each MIDI tempo is the file's own set-tempo event. Each matches the `\midi` block in its `.ly`.
  - Each printed tempo is the `.ly` text the PDF engraves.
  - None of the five prints a metronome number, so every number here is the typesetter's MIDI choice.
- **File hashes (sha256),** as the charts' `source` fields cite them:
  - `Chop-28-20.mid` 9cc6c417d4bb261644f6bd3d00033025e675a25694fd172be2f98e93efc1fcfe
  - `pathetique-2.mid` 92c685ca98001473bcc21fa98110cc125ab489c1bf49be185e062d204a268492
  - `MomentsNo3.mid` 77b5ccc3a0f33128f9f4c162743d6a484bbfaa952206b69584a4c14bafc60358
  - `Chop-28-15-lys.zip` 66ab25a554d012e56b419519fdbef092b12a87b34ada28cd720f97599bff4ed7. Its `Chop-28-15.mid` is
    bb9532e59bee378a42f0c53b64bf223ba4d6e261e00c1e2efb3ed8e023833bd9.
  - `debussy_Arabesque_1.ly` b3ddf344b94e48f90e9a4337f597463c9740249590538c7c3ab64803a9f09e69. Its `.mid` is
    6732dc10799ec0af47d19d9095562d0671864a750129e0279901def169a34757.
- **Ids:** none clashes with a song in `web/public/songs/`.
- **Credits:** all five are Public Domain, so there's no `CREDITS.md` line. Each `source` field names the typesetter.

## Hands: two scores cross staves
The Raindrop's and the Arabesque's left-hand parts reach into the treble staff (`\csrh`, `\cu`: `\change Staff`).
LilyPond's MIDI files a note under the staff it's printed on, so Mutopia's `.mid` gives those notes to the right
hand. That broke the library's hand-span rule three times in the Raindrop: the right hand spanned 17 semitones at
beats 12, 28 and 88 (the left hand's C4 under the tune). The spec says to follow the score where it crosses hands, so
these two charts come from a MIDI exported from the same LilyPond source, with the staff changes off:

```bash
convert-ly -e <copy of the .ly files>          # Mutopia's 2.12/2.18 syntax to LilyPond 2.26
sed -i '' 's/^csrh = .*/csrh = {}/; s/^cslh = .*/cslh = {}/' defs.ly                       # Raindrop
sed -i '' 's/^cu = { \\change Staff = "upper" }/cu = {}/; s/^cl = { \\change Staff = "lower" }/cl = {}/' debussy_Arabesque_1.ly
lilypond chopin_prelude_op28_no15.ly           # and debussy_Arabesque_1.ly: writes the .midi
```

- **Same notes:** over the charted bars, the export has exactly Mutopia's onsets and pitches. In the Raindrop, 42 notes
  move from the right-hand track to the left. In the Arabesque, the export also sounds 7 notes that Mutopia's
  shared track merged:
  - 4 pitches both parts strike at once (bars 3–4). The converter keeps each once, in the left hand.
  - 3 restrikes of a pitch the other part is holding (bars 31, 33 and 34). These are now charted, as the score prints
    them; the converter ends the held note where the restrike starts.
- **Velocity:** LilyPond 2.26 writes 94 for 8 accented Arabesque notes and 90 for the rest, so the converter read
  velocities. Dynamics are demo-performance's, not this pack's, so `velocity` was removed from that chart, as the
  other four have none.

## Ornaments and what the 1/12-beat grid can't hold
- **The Raindrop's two fioriture** (bars 4 and 23) are 7 eighths in one beat, which no 1/12-beat grid holds; the
  converter refuses them. Pack 1's rule charts an ornament as its main note, so a pre-pass keeps each figure's first
  note, held to the end of its beat, and drops the other six. The pre-pass is local: it reads the export's track 1
  and rewrites beats 15–16 and 91–92 (12 notes dropped, 2 lengthened).
- **The Pathétique's three 32nd notes** (the last note of bars 5, 13 and 16, at beat x.875) are off the grid too. The
  converter skips them as slivers. This is the one place a printed note is missing. Holding them needs a 1/24-beat
  grid in the converter, a `fix(song-pack-1)`.
- **Grace notes and appoggiaturas** are skipped (pack 1): 9 in the Moment musical and the Raindrop's 3-note
  appoggiaturas in bars 11, 15 and 17.

## The check against the score
Each chart was checked against its LilyPond source note by note, not only by count. A small LilyPond engraver listed
every struck notehead (staff, onset, MIDI pitch), leaving out tied-to heads and grace notes, then the list was diffed
against the chart:

| id | Heads in the score | Chart | Every difference |
|---|---|---|---|
| `chopin-prelude-20` | 286 | 286 | none |
| `raindrop-prelude` | 435 (401 once two voices sharing a head count once) | 389 | the 12 fioritura notes |
| `pathetique-2` | 267 | 263 | the three 32nds above, and a C3 struck in two voices at once (bar 14), sounded once |
| `moment-musical-3` | 438 | 438 | none |
| `debussy-arabesque-1` | 534 (523 once shared heads count once) | 515 | 8 pitches both hands strike at once, kept once in the left hand |

No chart has a note the score doesn't.

## Excerpts and how to rebuild them
Run from `game-tools/midi-to-chart/`. Each command adds `--id`, `--title`, `--composer`, `--catalog`, `--source` and
`-o`, taken from the chart's own fields.

```bash
.venv/bin/python convert.py Chop-28-20.mid --rh 1 --lh 2 --bars 1-13 --bpm 42 ...                 # the whole prelude, 74 s
.venv/bin/python convert.py rain-main-notes.mid --rh 1 --lh 2 --bars 1-27 --bpm 80 ...           # bars 1-27, 81 s
.venv/bin/python convert.py pathetique-2.mid --rh 1 --lh 2 --bars 1-16 --bpm 36 ...               # bars 1-16, 52 s
.venv/bin/python convert.py MomentsNo3.mid --rh 1 --lh 2 --bars 1-34 --bpm 80 ...                 # bars 1-34, 51 s
.venv/bin/python convert.py arab.midi --rh 1 --lh 2 --bars 1-38 --bpm 120 ...                     # bars 1-38, 76 s
```

**How to undo:** each chart's `source` field carries its provenance. To change a source or a hand rule, re-chart from
the file and edit its row here.
