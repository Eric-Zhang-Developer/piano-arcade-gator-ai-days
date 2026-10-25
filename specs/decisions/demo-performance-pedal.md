# demo-performance: where each song's pedal comes from

**Context.** The bot sends a song's `pedal.json` as CC64 (golden-demo). The spec takes it from the score's Ped. marks
and, for a score with none, from golden-demo's per-harmony rule, logged here. Findings: batch 1 on #815, batch 2 on #816, batch 3 on #818, batch 4 on #819, batch 6 on #1102, batch 7 on #1103, batch 8 on #1104, batch 9 on #1105.

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
| gnossienne-1 | Mutopia 2035: none | C (9 pairs) |
| entertainer | Mutopia 263: none | C (20 pairs), the same arrangement choice as maple-leaf-rag |
| mountain-king | Mutopia 1888: none in bars 1–17 (the first Ped. is at beat 100, past the excerpt); *e sempre staccato* | **none**, as burgmuller-arabesque: the rule would hold the printed staccato |
| alla-turca | Mutopia 108: none; staccato almost throughout | **none**, the same reason |
| minute-waltz | Mutopia 483: a printed pedal line, rendered in its MIDI as CC64 | A, the MIDI's CC64 over bars 1–20 (16 pairs, from bar 5, where the left hand enters) |
| happy-farmer | Mutopia 659: none | C (41 pairs), the rags' arrangement choice: its right hand's off-beat chords are written with rests between |
| wild-horseman | Mutopia 655: none; *vif*, staccato almost throughout | **none**, as mountain-king and alla-turca |
| old-french-song | Mutopia 2080: none | C (16 pairs) |
| minuet-g-minor | Mutopia 76: none | C (32 pairs), as bach-prelude-c |
| musette-d | Mutopia 79: none | C (40 pairs) |
| chopin-prelude-7 | Mutopia 470: `\sustainOn/Off` in the left hand, one or two a bar | A, read from the left hand (10 pairs) |
| traumerei | Mutopia 504: a pedal line, `\sustainDown/Up`, in bars 1–2 and 5–6 | A, read from it, both passes (8 pairs) |
| mozart-331-theme | Mutopia 614: none | C (16 pairs), as mozart-545-1 |
| brahms-waltz-15 | Mutopia 794: none | C (16 pairs) |
| invention-1 | Mutopia 40: none; two-part counterpoint | **none**: the rule reads the left hand as harmony, and here it is one moving line; the rule would blur the counterpoint. Eric may prefer C, as bach-prelude-c. |
| chopin-prelude-20 | Mutopia 472: `\sustainOn/Off` on each beat of bar 1 and bar 2's first, then *simile*; a Ped. at bar 12 beat 4, lifted on the final chord. Its MIDI renders only the 6 literal pairs | A, the printed pattern carried through as *simile* asks: one pair a beat, beats 0–48 (48 pairs). Taking the MIDI's 6 would leave bars 2–12 dry against the score |
| debussy-arabesque-1 | Mutopia 1777: an empty `pedal` voice, no CC64 | C (70 pairs) |
| moment-musical-3 | Mutopia 1023: none; a staccato left hand (marked in bars 1–2) | **none**, as alla-turca and wild-horseman: the rule would hold the staccato accompaniment. Eric may prefer C. |
| pathetique-2 | Mutopia 295: none | C (16 pairs) |
| raindrop-prelude | Mutopia 471: `\sustainOn/Off` macros in `sIsustain` (`sec1.ly`), rendered in its MIDI as CC64 | A, the MIDI's CC64 over bars 1–27 (47 pairs, checked against `sIsustain`) |
| chopin-fantaisie-impromptu | Mutopia 1693: `pd`/`pu` macros (`\sustainDown/Up`), one or two a bar, rendered in its MIDI as CC64 | A, the MIDI's CC64 over bars 1–24 (35 pairs, checked against the macros) |
| chopin-revolutionary | Mutopia 743: none | **none**, as invention-1: the left hand is one running line of sixteenths, which the rule would read as changing harmony and blur. Eric may prefer C. |
| liszt-consolation-3 | Mutopia 1647: `\sustainOn/Off`, rendered in its MIDI as CC64; bars 15–16 printed dry | A, the MIDI's CC64 over bars 1–18 (12 pairs) |
| rachmaninoff-prelude-cs | Mutopia 2033: none | C (26 pairs): a held bass under tenuto chords |
| pathetique-3 | Mutopia 296: none | C (71 pairs), as pathetique-2. The theme's staccato eighths will be held; Eric may prefer none. |

**The rule (C)**, as golden-demo's (`specs/context/findings.md`, 2026-10-25). A harmony is the left hand's pitch
classes struck in a half bar (a whole bar unless the bar has 4 beats). A new pair starts at a window that strikes a
new set, at the left hand's first strike in a bar, or after a left-hand rest of a bar or more. Down 60 ms after,
up 20 ms before the next; a rest of a bar or more lifts it.

**Watch on the DGX listen (batch 3):** the rule holds a pedal over the right hand's scale runs on one left-hand harmony
(Clementi bars 7–8, Mozart bars 5–8). If that blurs, the change is to the rule, for the whole library.

**How to undo.** Delete a song's `pedal.json` and its line in `web/src/game/pedal/library.json`: that song plays dry.
