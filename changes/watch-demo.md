## What shipped
W on the music select plays the focused song with the perfect bot, audible and
hands-off. The DEMO badge sits on the HUD, nothing is saved to records, and 8 s after the results it returns to `/`.
With the DGX on USB the demo plays on the piano, otherwise a laptop tone.
## Where it lives
`web/src/game/watch-demo/` (plugin, `watchUrl`, `isWatchKey`, `verify-watch.mjs`; #528) · select-layout's W and hint
(#580) · song-preview's W stop (#581; its WATCH link came out in #599) · results-layout's `demoFeatured` (#582) · screens in
`specs/features/watch-demo/screens/`
## How to check it
`node web/src/game/watch-demo/verify-watch.mjs --out <dir>` prints `verify-watch: pass`: 100.0%, records 67 bytes
unchanged, back on `/` 8.4 s after the results. `verify.py --slug watch-demo`: pass at 903aa67 (42/42 PERFECT with
test input and on /sim).
## Gaps
- verify-watch's pass above was at 903aa67, before its WATCH-link step came out (#599); its rerun without that step
  is pending (local checks paused for Eric's play session), so CI's run of it on this PR is the check.
- **Not checked by Eric:** W on Für Elise with the DGX on USB: does it play on the piano, in time, with no hung notes
  after the return? Web MIDI doesn't run headless.
- The return lands on `/` with the first song focused, not the one demoed (spec: later, if wanted).
