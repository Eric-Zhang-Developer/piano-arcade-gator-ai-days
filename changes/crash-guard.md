## What shipped
One plugin's throw no longer freezes /play (#286). Each take has a guard: a plugin whose draw, onEvent or background frame throws is turned off for that take (one `console.error`, its layer cleared, and the toast "<id> stopped after an error. The game goes on."), and the rest of the game plays on to its results. drawHighway and the judge are caught and logged once per message, and the frame loop always asks for the next frame. A render error anywhere under the layout shows a "Something broke." card with "Back to the song list" (focused; a full load of `/`) and "Try again". Test hooks: `?crash=draw|event|render`.
## Where it lives
`web/src/game/crash-guard/` (guard, `GameBoundary`, the `crashGuard()` test plugin, tests, `verify-crash.mjs`; #416) · `web/src/app/play/page.tsx` and `web/src/app/layout.tsx` (#423) · `specs/decisions/crash-guard-core-and-background.md` · screens in `specs/features/crash-guard/screens/`
## How to check it
`node web/src/game/crash-guard/verify-crash.mjs --out <dir>` prints `verify-crash: pass`: draw and event crashes each log one line, show the toast (gone by 5 s) and still reach 42 PERFECT; the card on `/` and `/play` with Enter back to `/`; a pitch-30 press reaches results. Without #423, steps 1–2 fail (no results; 38/42 PERFECT). `verify.py --slug crash-guard`: 42/42 PERFECT with test input and on /sim.
## Gaps
- **Not looked at by Eric:** the card and the toast once (nothing to do on the piano).
- "Try again" isn't covered by the check; with `?crash=render` it shows the card again, as it should.
- A throw elsewhere in a frame (the countdown, the pause clock) still reaches the console each frame, but the next frame is requested.
