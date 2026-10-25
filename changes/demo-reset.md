## What shipped
Shift+Esc on any page (not `/cabinet`, `/attract`, `/operator` or `/sheet`) sends All Notes Off on all 16 channels to every MIDI output, now and again 250 ms ahead, then loads `/` fresh. A plain take's results (no `cabinet` in the URL) do the same after 60 s with no key, pointer, wheel or piano note; a replay on the piano or on screen holds that wait, and `?idle=<s>` shortens it. Esc alone is unchanged, and localStorage and sessionStorage (latency, records, capture mode) are kept.
## Where it lives
`web/src/game/demo-reset/` (#454), one line in `web/src/game/layers.ts`, `<DemoReset />` in `web/src/app/layout.tsx` (#456), cabinet's idle watch as `whenIdle` in `web/src/game/cabinet/idle.ts` (#435).
## How to check it
verify: `pnpm -C web verify` + `verify-sim.mjs` pass at fe2fe44 (evidence: `.git/agent-evidence/demo-reset/20261024T172030Z`). `node web/src/game/demo-reset/verify-reset.mjs --out <dir>`: all 11 checks passed at a41e39d (origin/main with #482's fix for the latency read, #478, plus a stricter latency check that was closed as unneeded, #481): Shift+Esc mid-take -> `/` with All Notes Off on 16 of 16 channels, latency 37 ms kept (stored 37), idle -> `/` after 3.2 s with `?idle=3`, a key restarts it, `?cabinet=1` and a piano replay hold it, Esc alone still pauses.
## Gaps
- Not verified by Eric on the DGX: hold a chord while the left hand plays (`hands=R`), press Shift+Esc; does anything keep sounding?
- Shift+Esc never reaches the page in Chrome on Windows or Linux (Task Manager); it's one constant to change if the demo laptop isn't the Mac.
- The ghost (`pianoArcade.ghost`) is kept across a reset (the spec's default); Eric's open question.
