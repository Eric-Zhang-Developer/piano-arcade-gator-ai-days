## What shipped
A NEW RECORD take gets an arcade moment on the results screen: the rank stamp lands, then NEW RECORD and three initials cells reveal (keys typed early are kept), Enter saves and the line reads `ERI · saved`, Retry takes the focus. Reduced motion shows it at once. Built over #495 (shared initials hook), #497 (timing and plugin), #499 (records hands the entry over), #525 (results-layout features it, the graph moves to details) and this PR (verify-moment.mjs).
## Where it lives
`web/src/game/record-moment/`, `web/src/game/records/initials.ts`, `web/src/game/results-layout/`, `specs/decisions/record-moment-graph.md`
## How to check it
verify: `pnpm -C web verify --out {out} && node web/src/game/sim/verify-sim.mjs --out {out}/sim` pass at 4236d77; `verify-moment: pass` and `verify-records: pass` (1280×720 and 1920×1080, with a 4 s video of step 1).
## Gaps
Not tried by a person: Eric's two Twinkle takes on the piano (does it feel like an arcade's?). After Enter the cells collapse to the saved line and the buttons below shift up. Untested on Safari and Firefox.
