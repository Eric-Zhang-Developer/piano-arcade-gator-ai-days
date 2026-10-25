# demo-performance: the library's mark→velocity mapping

**Context.** The bot plays `note.velocity ?? KEYS_VELOCITY` (80). The spec asks for velocities from each score's
dynamic marks with one mapping for the library, never from memory or a recording. The song packs' converter already
writes velocities where a source's MIDI renders them (decided on #181). Findings for batch 1 are on #815.

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

A single level reads as "This score marks no dynamics" in the dynamics grade (it needs two levels), as before.

**How to undo.** Strip `velocity` from a chart: it plays at 80 again.
