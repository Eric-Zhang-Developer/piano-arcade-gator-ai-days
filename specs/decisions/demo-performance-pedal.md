# demo-performance: where each song's pedal comes from

**Context.** The bot sends a song's `pedal.json` as CC64 (golden-demo). The spec takes it from the score's Ped. marks
and, for a score with none, from golden-demo's per-harmony rule, logged here. Findings: batch 1 on #815, batch 2 on #816, batch 3 on #818.

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
| clementi-sonatina-36-1 | Mutopia 804: none | C (38 pairs) |
| burgmuller-arabesque | Mutopia 203: none; every note staccato, *leggieremente* | **none** (batch 3's choice, #818): the rule would hold the score's staccato. Eric may prefer C. |
| bach-prelude-c | Mutopia 5: none | C (11 pairs, one a bar: each bar is one harmony) |
| mozart-545-1 | Mutopia 998: none | C (19 pairs) |
| minuet-g | Mutopia 75: none, and the chart is the right hand only | none: the rule needs a left hand |
| nocturne-op9-2 | Mutopia 1590: Ped. on each left-hand bass note, * on its third eighth, as glyph macros (`\ped`, `\pes`) | A, read from the left hand (28 pairs) |
| moonlight-3 | Mutopia 276: `\sustainDown/Up` in bars 2, 4, 6, 7 and 8, not rendered in its MIDI | A, read from its `sustain` line (5 pairs) |
| gymnopedie-1 | Mutopia 37: none | C (10 pairs) |
| clair-de-lune | Mutopia 1778: an empty pedal voice; "con sordina" is the soft pedal, which the bot can't send | C (8 pairs) |
| maple-leaf-rag | Mutopia 23: none | C (33 pairs), an arrangement choice: a rag usually pedals lightly |

**The rule (C)**, as golden-demo's (`specs/context/findings.md`, 2026-10-25). A harmony is the left hand's pitch
classes struck in a half bar (a whole bar unless the bar has 4 beats). A new pair starts at a window that strikes a
new set, at the left hand's first strike in a bar, or after a left-hand rest of a bar or more. Down 60 ms after,
up 20 ms before the next; a rest of a bar or more lifts it.

**Watch on the DGX listen (batch 3):** the rule holds a pedal over the right hand's scale runs on one left-hand harmony
(Clementi bars 7–8, Mozart bars 5–8). If that blurs, the change is to the rule, for the whole library.

**How to undo.** Delete a song's `pedal.json` and its line in `web/src/game/pedal/library.json`: that song plays dry.
