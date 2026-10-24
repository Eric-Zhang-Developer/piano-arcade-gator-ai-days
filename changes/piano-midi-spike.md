## What shipped
A throwaway feasibility spike: on the real DGX-660 a laptop reads every key (velocity, pedal, no clumping) and plays notes and a drums+bass band, in Python and Chrome. R1–R7 all pass; no fallback applies.
## Where it lives
`spikes/piano-midi/` (`midi.py`, `index.html`, `macos.md`, `RESULTS.md`, `python-iac.log`, `python-piano.log`)
## How to check it
not verified: `[verify].command` is empty. The evidence is `spikes/piano-midi/RESULTS.md` (logs, port names, velocity and gap numbers).
## Gaps
Chrome input twice stalled for minutes for an unknown reason (maybe a second tab on the same port); the MIDI I/O lane should reproduce it. Untested: Local Control panel route, runs over ~8 notes/s, a direct USB connection without the hub.
