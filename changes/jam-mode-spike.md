## What shipped
A tech spike: a page where the DGX's drums and bass follow the chords a player holds, named from MIDI and taken up from the next beat. Over the IAC loopback it named 21 of 21 changes right, put 335 of 335 bass notes on the right root, followed a change in a median 343 ms (max 629 against a 650 ms bar), and left no stuck notes. Recommendation: promote, once Eric's ears agree.
## Where it lives
`spikes/jam-mode/` (`jam.mjs`, `index.html`, `loopback.mjs`, `FINDINGS.md`), `specs/decisions/jam-mode-spike-rename.md`.
## How to check it
`node spikes/jam-mode/jam.mjs --self-test`: 318 passed. `verify.py --slug jam-mode-spike --cmd "node spikes/jam-mode/loopback.mjs --out {out}"`: pass at 00cbd89 (the loopback; it needs IAC Driver online).
## Gaps
Ears pending: Eric hasn't played it on the DGX (Validation 3), and promote waits on that. Rolled chords may flicker to a wrong root for a moment; that's untested without a human take, and phase 2 should add a settle window. The page skipped the design pass: it's a spike's test page in `spikes/`, not a game screen.
