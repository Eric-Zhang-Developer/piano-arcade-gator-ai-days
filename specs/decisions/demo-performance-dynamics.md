# demo-performance: the library's mark→velocity mapping

**Context.** The bot plays `note.velocity ?? KEYS_VELOCITY` (80). The spec asks for velocities from each score's
dynamic marks with one mapping for the library, never from memory or a recording. The song packs' converter already
writes velocities where a source's MIDI renders them (decided on #181). Findings: batch 1 on #815, batch 3 on #818.

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
- An accent (`->`, `\accent`) or **sf** is one step (+16) on that note only.
- A mark sets its own staff, and the other staff too unless that staff has its own mark at the same beat. Written-out
  repeats repeat their marks.
- burgmuller-arabesque: LH p at bar 1, RH p at bar 3 (both passes), *cresc.* from bar 5 to the first ending (both
  passes), sf on the first ending's last note: 49–65, the sf note 81. Its MIDI velocities (69/90/127) are replaced.
- mozart-545-1: RH mp and LH p at bar 1; an accent and a one-step swell in bars 3–4; p with a rise and fall each half
  bar in bars 5–8; p and a swell in bar 9; f and an accent at bar 11: 49–112. Its MIDI velocities (69–98) are replaced.
- clementi-sonatina-36-1, bach-prelude-c, minuet-g: no marks, no velocity (80).

A single level reads as "This score marks no dynamics" in the dynamics grade (it needs two levels), as before.

**How to undo.** Strip `velocity` from a chart: it plays at 80 again.
