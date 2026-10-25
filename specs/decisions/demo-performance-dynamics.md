# demo-performance: the library's mark→velocity mapping

**Context.** The bot plays `note.velocity ?? KEYS_VELOCITY` (80). The spec asks for velocities from each score's
dynamic marks with one mapping for the library, never from memory or a recording. The song packs' converter already
writes velocities where a source's MIDI renders them (decided on #181). Findings: batch 1 on #815, batch 2 on #816, batch 3 on #818, batch 4 on #819, batch 6 on #1102.

**Options.** (A) golden-demo's ladder for printed marks; (B) whatever each MIDI export renders, which differs by
typesetter and is flat for most of these sources.

**Choice: A**, the same ladder as `golden-demo-dynamics.md`: ppp 16, pp 33, p 49, mp 64, mf 80, f 96, ff 112, fff 127.
`perform.py velocity --mark` applies it to an excerpt under one printed mark.
- fur-elise: pp at the opening, nothing else in the excerpt: every note 33.
- moonlight-1: "sempre pianissimo" at bar 1 and pp at bar 5: every note 33.
- ode-to-joy, twinkle: no marks: no velocity, so 80.
- **chopin-prelude-4 is the exception for now:** it keeps the velocities #181 gave it. Those come from the source's
  MIDI-only dynamics layer (the left hand at ppp–pppp under the melody), not its printed p and hairpins. #815 asks Eric
  to choose between those and the printed marks on this ladder.

**Several marks in one excerpt** (batch 3, #818): `perform.py velocity --marks` takes them in chart beats, read from the
LilyPond source (the commands are in `game-tools/midi-to-chart/README.md`). Its rules, added here:
- Before the first mark, mf. A hairpin (or a *cresc.* with no mark ending it) ramps one step (16) linearly over its
  span, then holds. A *cresc.* runs to the next mark, or to the end of its phrase.
- An accent (`->`, `\accent`, a marcato `-^`), **sf** or **fz** is one step (+16) on that note only.
- A mark sets its own staff, and the other staff too unless that staff has its own mark at the same beat. Written-out
  repeats repeat their marks.
- burgmuller-arabesque: LH p at bar 1, RH p at bar 3 (both passes), *cresc.* from bar 5 to the first ending (both
  passes), sf on the first ending's last note: 49–65, the sf note 81. Its MIDI velocities (69/90/127) are replaced.
- mozart-545-1: RH mp and LH p at bar 1; an accent and a one-step swell in bars 3–4; p with a rise and fall each half
  bar in bars 5–8; p and a swell in bar 9; f and an accent at bar 11: 49–112. Its MIDI velocities (69–98) are replaced.
- clementi-sonatina-36-1, bach-prelude-c, minuet-g: no marks, no velocity (80).

**Read from the LilyPond** (batch 2, #816): `perform.py dynamics` reads the marks and accents (`->`, `\accent`) off the
cited voices, a mark on the note it follows, and turns them into the same `--marks` list on the same rules, printing it.
It refuses unless every chart note is a MIDI note-on of its pitch at its mapped time, so a wrong bar range can't put a
mark on the wrong note. On one note a level comes before a hairpin's start, so `\p\<` swells from p; fp is an accent,
then p. Text *cresc.*/*dimin.* written as markup isn't read; the hairpins under it are.
- gymnopedie-1 (bars 22–31): p in force from bar 21; < over bars 22–24, > in 25, < from 26, > in 29: 49–65.
- nocturne-op9-2 (pickup + bars 1–8): the opening marks only *espress. dolce*, no level, so mf; a swell in bar 2, f at
  bar 4, p at bar 5, then four accents, a swell and a fall in bars 5–6, f at bar 8 with a swell: 49–112.
- maple-leaf-rag (the A strain twice, as its MIDI unfolds it): f at the pickup, then p at bar 7 and mf with a
  crescendo at bar 9 in both passes: 49–96.
- moonlight-3 (bars 1–8): p, and sf on the right hand's chord in bars 2, 4, 6, 7 and 8: 49, the sf chords 65.
- clair-de-lune (bars 1–8): pp at the opening, nothing else: every note 33.

**Batch 4** (#819). `dynamics` read Entertainer and Mountain King whole. The rest are `--marks` read by hand, because
`dynamics` reads one variable per voice (Alla turca's sections are nested variables, in German note names, and Gnossienne's
themes too), and it doesn't read `fz` or a marcato.
- gnossienne-1 (bars 1–9): p, a falling hairpin at beats 22–25, f at beat 28: 33–96.
- entertainer (intro and A strain): f, then the strain's echo pairs (each a short hairpin into the next level): p at 8,
  f at 12, p at 16, f at 20, p at 24, f from 28; a marcato on the right hand's chord at beat 7: 49–112.
- mountain-king (bars 1–17): p and an accent at 0, pp from beat 4, 23 right-hand accents: 33–65. Its MIDI's
  `articulate.ly` velocities (62/69) are replaced.
- alla-turca (A, A, B+A′, B+A′): p in A with accents at 7 (R) and 9, 11, 13 (both hands); mp in B with right-hand accents
  each bar; p in A′, a *cresc.* into an fz, p again, an accent: 49–80.
- minute-waltz (bars 1–20): no level mark, so mf; an accent on the first note, then six one-step hairpins: 64–96.

**Batch 6** (#1102). All hand-read `--marks`, checked against the chart's notes at each beat. `dynamics` lays a
dynamics line kept outside a `\repeat volta` (Wild Horseman) straight over the unfolded MIDI, which moves B's marks onto
A's second pass. It also misplaces accents inside `\voiceOne << >>` blocks (Happy Farmer).
- happy-farmer (the pickup and bars 1–20): f, restated at bars 4, 10 and 16; accents on both hands' melody notes in
  bars 9, 10, 15 and 16: 96, the accents 112.
- wild-horseman (A twice, then B): mf at the pickup; sf on the downbeats of bars 2, 3, 6 and 7 in both passes of A,
  and of bars 10, 11 and 14 in B: 80, the sf notes 96.
- old-french-song (the pickup and bars 1–16): p, then pp on bar 8's last eighth: 49, then 33.
- minuet-g-minor, musette-d: no marks, no velocity (80).

A single level reads as "This score marks no dynamics" in the dynamics grade (it needs two levels), as before.

**How to undo.** Strip `velocity` from a chart: it plays at 80 again.
