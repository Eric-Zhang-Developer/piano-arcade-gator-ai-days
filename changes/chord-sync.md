## What shipped
A results panel that flags rolled chords, per hand. A chord is 2 or more chart notes in one hand at one beat (both hands at one beat are two chords). Its spread is the latest minus the earliest press among its hit notes, and it's rolled over 30 ms (`chordSyncSettings.maxSpreadMs`; exactly 30 isn't). Fewer than 2 hits is incomplete, not rolled. The panel reads "1 of 10 chords rolled", then one row per rolled chord: "Bar 2, beat 2, left hand: 45 ms, low to high" (or "high to low", "mixed"). Charts with no chords, like Twinkle, render nothing.
## Where it lives
`web/src/game/chord-sync/` (`chords.ts` pure scoring, `index.ts` the panel plugin, `chords.test.ts`, `verify-chords.mjs`), one entry in `web/src/game/layers.ts`, screenshots in `specs/features/chord-sync/screens/`.
## How to check it
`verify.py --slug chord-sync` pass at 3a9e3d7: 42/42 PERFECT with test input and through the MIDI path on /sim. `node web/src/game/chord-sync/verify-chords.mjs --out <dir>` pass at 3a9e3d7: Gymnopédie No. 1 played through `window.__pianoArcade.press` with only its second left-hand chord spread 0, 22.5 and 45 ms. The panel read exactly "1 of 10 chords rolled" and "Bar 2, beat 2, left hand: 45 ms, low to high".
## Gaps
- Not tried on the piano (Eric: roll one chord on purpose and play the others together; only that one should be flagged).
