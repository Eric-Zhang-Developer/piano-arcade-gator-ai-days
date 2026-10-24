## What shipped
In wait mode (`?mode=wait`), after 3 s of wall time on a note, three things happen: its key lights in its hand's color, pulsing between 0.35 and 0.9 over 1 s (steady under reduced motion); the note sounds once, on the DGX at velocity 80 or else as a laptop tone, at most 1 s; and its name (`C4`; a chord's names, lowest first) shows large in Saira 900, outlined, with its bottom 500 ms of highway above the line. Pressing every waiting key ends the hint. A pause ends it, and a fresh 3 s starts after the resume. The plugin keeps its own map of hit notes from `noteHit`. Test hook: `window.__pianoArcadeWaitHint`.
## Where it lives
`web/src/game/wait-hint/` (`hint.ts` timing, `index.ts` plugin, tests, `verify-wait-hint.mjs`) · one line in `web/src/game/layers.ts`, after `noteLabels()` · `specs/decisions/wait-hint-outline-and-voice.md` · screens in `specs/features/wait-hint/screens/`
## How to check it
`node web/src/game/wait-hint/verify-wait-hint.mjs --out <dir>` prints `verify-wait-hint: pass`: no hint and no note-on 2.5 s in; at 3.5 s the hint is C4 with one note-on of 60, still one at 6 s; pressing clears it; the next hold hints again at 3.5 s. `verify.py --slug wait-hint`: pass at 01465dc.
## Gaps
- **Not tried on the piano.** Eric: wait on a Für Elise note. After 3 s the DGX plays it once, its key pulses and its name shows. Check the hint's own note never counts as your press; if it does, add hand-mode's `echoGuard`. Not verified by Eric.
- **The "starts over" step is weak on Twinkle,** whose second note is also C4. It's proven by the timer resetting (no hint 2.5 s into the new hold) and by the unit tests.
