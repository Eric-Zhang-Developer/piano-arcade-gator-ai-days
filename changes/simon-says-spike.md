## What shipped
A Simon Says spike at `/simon`: the DGX (or the laptop) plays the opening notes of a library song, you repeat them,
and each round adds a note. One wrong pitch ends the run. It's linked from nowhere, so it's off the demo path.
## Where it lives
`web/src/app/simon/page.tsx` · `web/src/game/simon/` (melody, phrase messages, the run reducer, tests,
`verify-simon.mjs`, CSS) · `spikes/simon-says/FINDINGS.md` · `specs/decisions/simon-says-spike-page-choices.md`
## How to check it
`node web/src/game/simon/verify-simon.mjs --out <dir>` prints `verify-simon: pass`. `verify.py --slug
simon-says-spike`: pass at 333ca81 (42/42 PERFECT with test input and on /sim).
## Gaps
- **Playtest pending (the spike's question):** Eric on the DGX with non-pianists; FINDINGS.md says "iterate: run the playtest".
- Not verified: DGX playback timing, and silence after Again or leaving the page (Web MIDI doesn't run headless).
- Not built: random notes in a scale (the stretch goal).
