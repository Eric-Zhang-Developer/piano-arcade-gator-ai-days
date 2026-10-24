## What shipped
`?hands=R` or `?hands=L` (default `both`) on a two-hand chart: the other hand leaves the chart that's drawn and judged, so results score only the hand you play, and the piano plays it in time. It goes on MIDI channel 1 to "Portable Grand" with the chart's velocities (80 when absent), queued on beat-track's clock, or as a quiet laptop tone without a piano. A note-on echoing one we sent within 30 ms is dropped, never judged. songEnd, pause, quit and pagehide send All Notes Off on channel 1 and drop queued sends. The start screen has Right / Left / Both buttons (two-hand charts only) that reload `/play` with `hands=`. One-hand charts ignore the setting.
## Where it lives
`web/src/game/hand-mode/` (`hands.ts` pure split, schedule and echo guard, `index.ts` the plugin, `HandPicker.tsx`, `hands.test.ts`, `verify-hands.mjs`), one entry in `web/src/game/layers.ts` (after bar-loop, before scenes and the sim), screenshots in `specs/features/hand-mode/screens/`.
## How to check it
`verify.py --slug hand-mode` pass at ba95cc2: 42/42 PERFECT with test input and through the MIDI path on /sim. `node web/src/game/hand-mode/verify-hands.mjs --out <dir>` pass at ba95cc2: `/play?song=fur-elise&hands=R&midi=sim&input=test` judged only the 186 right-hand notes, all PERFECT. The fake piano received all 108 left-hand notes on channel 1 with the chart's pitches and velocities, spaced within 0.0 ms of the chart and 0.5 ms from beat-track's first kick, then All Notes Off.
## Gaps
- The spec's check reads "the sim's log shows the left hand"; the /sim log shows only the fake piano's input (its output is never echoed, R7), so the check reads the fake output's sent list instead.
- The laptop-tone fallback and the echo guard on a real DGX echo are unit-tested, not heard or seen live.
- Not tried on the piano (Eric: Für Elise's right hand with `?hands=R`, the DGX playing the left in time, nothing hanging after, no echo as an extra).
