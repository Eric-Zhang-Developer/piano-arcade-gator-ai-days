## What shipped
The results screen's six counts tally up arcade style: PERFECT first, then each in turn, ease-out, all done within
1.2 s; reduced motion shows the final numbers at once. The `count-*` testids hold the final number from the first frame.
## Where it lives
`web/src/game/results-tally/` (`tally`, `tallyProgress`, `<Tally>`), used in `web/src/game/results-layout/index.tsx`;
frames in `specs/features/results-tally/`; choice in `specs/decisions/results-tally-final-number.md`.
## How to check it
verify: pass, 42/42 PERFECT with test input and through the MIDI path on /sim (results-tally, fc356a6)
## Gaps
The tally runs under juice's rank reveal rather than after it (rank-stamp orders them). Eric's eye: not verified by Eric.
