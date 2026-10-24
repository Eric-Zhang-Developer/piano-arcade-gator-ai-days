# Mozart's moves

Read from the score: the numbers come from `transform.py stats` (TAVERN's notes, written bars without repeats),
and the descriptions come from the Peters scan (pages 24 to 30, see `SOURCE.md`). Bars use TAVERN's numbering:
section *k* is bars 24*k*+1 to 24*k*+24, and every section is |: 8 bars :||: 16 bars :|.

| | Bars | Notes per bar | Shortest note | Right hand | Left hand | Onsets with 2+ notes |
|---|---|---|---|---|---|---|
| Theme | 1-24 | 4.0 | 1/16 | C5-A5 | C3-F4 | 1 |
| Var 1 | 25-48 | 8.8 | 1/16 | B4-E6 | C3-F4 | 4 |
| Var 2 | 49-72 | 11.7 | 1/32 | E4-A5 | C2-A4 | 33 |
| Var 3 | 73-96 | 9.0 | 1/16 | C4-E6 | C2-F4 | 29 |
| Var 4 | 97-120 | 10.2 | 1/16 | E4-A5 | F1-G4 | 34 |
| Var 5 | 121-144 | 5.0 | 1/16 | G4-C6 | C3-A4 | 7 |
| Var 6 | 145-168 | 13.3 | 1/16 | F#3-A5 | C2-E4 | 45 |
| Var 7 | 169-192 | 8.8 | 1/16 | C4-E6 | C2-E4 | 28 |
| Var 8 | 193-216 | 5.9 | 1/16 | Eb4-Ab5 | G1-C5 | 25 |
| Var 9 | 217-240 | 5.3 | 1/16 | D4-C6 | G1-C5 | 34 |
| Var 10 | 241-264 | 9.8 | 1/16 | C4-A5 | F#1-D4 | 51 |
| Var 11 | 265-288 | 13.5 | 1/48 | E4-F6 | G2-G4 | 62 |
| Var 12 | 289-324 | 17.9 | 1/32 | B3-E6 | F1-F4 | 31 |

## Variation by variation

- **Theme (1-24):** the tune in quarter notes in the right hand over a quarter-note left hand. mf, p at bar 9, mf
  at bar 17.
- **Var 1 (25-48): figuration.** The right hand turns the tune into running 16ths with chromatic neighbour notes
  (F#, G#, C#, D#), and climbs to E6. The left hand stays plain.
- **Var 2 (49-72): the figuration changes hands.** Running 16ths move to the left hand; the right hand plays the
  tune in two-note chords with tied suspensions.
- **Var 3 (73-96): triplets.** Right-hand 8th-note triplets in arpeggios that leap up and back down, C4 to E6.
- **Var 4 (97-120): the triplets change hands.** Left-hand triplet arpeggios reach F1; the right hand plays the
  tune in chords.
- **Var 5 (121-144): rests.** The tune is broken up: the right hand plays on the beat, the left hand answers off
  the beat. The thinnest variation (5.0 notes per bar).
- **Var 6 (145-168): chords over a running bass.** Three-note right-hand chords carry the tune over left-hand 16ths.
- **Var 7 (169-192): scales.** Right-hand 16th-note scales run up an octave and more (bar 169: C4 up through B4,
  on into the next bar).
- **Var 8 (193-216): mode.** C minor ("Minore", three flats), and imitation: two bars in, the left hand takes up
  the right hand's rising figure a fifth lower (bar 195: F G Ab Bb, answering bar 193's C D Eb F). Chromatic
  lines with B natural and F#.
- **Var 9 (217-240): back to major ("Maggiore"), in imitation.** The left hand rests for two bars, then
  imitates the right hand's opening a fifth lower (bars 219-220: F F C C under the right hand's C C G G of
  217-218).
- **Var 10 (241-264): hand crossing.** The left hand (marked L.H.) plays above the right; chromatic inner voices
  (Eb, F#, Ab) and leaps down to F#1. The most chords of any 2/4 variation (51).
- **Var 11 (265-288): tempo.** Adagio (TAVERN's tempo halves, 120 to 60). Ornate: 32nds, 64th-note
  triplets (the shortest note in the set, 1/48), turns, fp accents, and repeated left-hand chords in the second
  half.
- **Var 12 (289-324): meter, speed, range.** Allegro in 3/4: the only meter change in the set. Left-hand 16ths run
  through the first half; right-hand 16ths through much of the second. Then a 12-bar coda (313-324) with two-octave
  16th scales, p at 319, cresc., ff. The densest (17.9 notes per bar, 644 notes) and widest (F1 to E6).

## The moves, and the bars

| Move | Where |
|---|---|
| Figuration: the tune dissolves into faster notes | 1 (16ths), 3 (triplets), 7 (scales), 11 (32nds, 64ths), 12 (16ths) |
| The texture changes hands | 1 to 2 (16ths), 3 to 4 (triplets), 6, 10 (hands cross) |
| Mode | 8 (C minor), 9 (back to major) |
| Imitation between the hands | 8, 9 |
| Tempo | 11 (Adagio), 12 (Allegro) |
| Meter | 12 (3/4) |
| Register widens | from C3-A5 in the theme to F1-E6 in Var 12 |
| Density grows | 4.0 notes per bar in the theme, 17.9 in Var 12 |

## What Variation 13 takes further

| Mozart | Var 13 (`transform.py`) |
|---|---|
| Var 11's Adagio and ornaments | **Music box** (`m_musicbox`): the theme's first phrase two octaves up, in octaves, at 54 BPM, over 64th-note arpeggios of the theme's own harmony sweeping four octaves on every beat |
| Vars 8 and 9's imitation | **Canon** (`m_canon`): the first phrase as a four-voice canon over four octaves, a voice every two bars (Mozart's distance in Vars 8 and 9). The tune's own harmony makes it fit: four voices at once spell ii7, then I |
| Var 8's minor, Var 7's scales | **Storm** (`m_storm`): the theme's last 16 bars in C minor at 132 BPM; on every beat the tune in octaves, a 32nd-note cascade down two octaves, and a left-hand tremolo in octaves: three hands' work |
| Var 12's 3/4 and running 16ths | **Band** (`m_band`): Var 12's first half at 152 BPM, both hands doubled an octave out, with drums and bass |
| Register, density, the coda's ff | **Apotheosis** (`m_apotheosis`): the theme's return in chords from the bottom of the keyboard to the top, each after a 64th-note sweep, broadening to a C major chord over seven octaves (C1 to C8) |
