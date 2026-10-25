# demo-performance: where each song's pedal comes from

**Context.** The bot sends a song's `pedal.json` as CC64 (golden-demo). The spec takes it from the score's Ped. marks
and, for a score with none, from golden-demo's per-harmony rule, logged here. Findings for batch 1 are on #815.

**Options.** For each song, in order: (A) the score's printed Ped. marks; (B) a pedal layer in the cited source file
that only its MIDI renders, written by the edition's typesetter; (C) the per-harmony rule, an arrangement choice.

**Choice: the first that exists, per song.** `game-tools/midi-to-chart/perform.py` writes each one; the README has
the commands.

| Song | Source | Pedal |
|---|---|---|
| fur-elise | Mutopia 931: an engraved pedal line, not rendered in its MIDI | A, read from the LilyPond (24 pairs in the excerpt) |
| chopin-prelude-4 | Mutopia 921: nothing printed; a MIDI-only `Pedal` layer | B, the MIDI's CC64 (24 pairs). Eric may prefer C (#815). |
| moonlight-1 | Mutopia 276: "senza sordini" (pedal throughout), no change marks | C (11 pairs): the score asks for pedal, not where to change it |
| ode-to-joy | Mutopia 528: none | C (27 pairs) |
| twinkle | Wikipedia LilyPond: none, and no left hand | none: the rule needs a left hand |

**The rule (C)**, as golden-demo's (`specs/context/findings.md`, 2026-10-25). A harmony is the left hand's pitch
classes struck in a half bar (a whole bar unless the bar has 4 beats). A new pair starts at a window that strikes a
new set, at the left hand's first strike in a bar, or after a left-hand rest of a bar or more. Down 60 ms after,
up 20 ms before the next; a rest of a bar or more lifts it.

**How to undo.** Delete a song's `pedal.json` and its line in `web/src/game/pedal/library.json`: that song plays dry.
