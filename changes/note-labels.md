## What shipped
Labels on the keys and the falling notes, in three modes: `notes` (C D E F G A B, sharps as C♯, every C with its octave, middle C is C4), `keys` (the laptop letter that plays each key, from core's `keyMap`; keys with none stay blank) and `off`. The default `auto` shows laptop letters until the first MIDI note-on, then letter names. Set it with `?labels=` (wins) or `localStorage["pianoArcade.labels"]`, or with the "Labels:" button on the start screen, which cycles Auto, Note names, Laptop keys and Off and remembers the choice. Note labels sit just above each note's white head, in dark type that reads on both hand colors. They hide on notes too short to hold them, on lanes under 14 px and with `?perspective`. Any label wider than its lane hides.
## Where it lives
`web/src/game/note-labels/` (`labels.ts` pure logic, `index.ts` the plugin, `LabelToggle.tsx`, `labels.test.ts`, `verify-labels.mjs`), one entry in `web/src/game/layers.ts` (after bar-loop, scenes and the sim), screenshots in `specs/features/note-labels/screens/`.
## How to check it
`verify.py --slug note-labels` pass at 78c9268: 42/42 PERFECT with test input and through the MIDI path on /sim. `node web/src/game/note-labels/verify-labels.mjs --out <dir>` pass at 78c9268: with no MIDI, auto showed laptop letters on keys and notes. `?labels=notes` showed letter names, `?labels=off` showed none, and the start button went "Labels: Auto" to "Labels: Note names" and stored `notes`.
## Gaps
- Auto's switch to letter names on a real MIDI note-on is unit-tested, not seen live (headless has no MIDI device; the sim's bot plays as `midi` only on /sim).
- Not tried by hand in desktop Chrome or on the piano (Eric: play Twinkle with labels on and say whether they help or clutter).
